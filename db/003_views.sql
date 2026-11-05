-- =====================================================================
-- CPMS - 003_views.sql : reporting views
-- (joins, aggregates, subqueries, CASE expressions)
-- Safe to re-run (CREATE OR REPLACE).
-- =====================================================================

USE cpms_db;

-- ---------------------------------------------------------------------
-- Active primary guide per project (helper view)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_project_primary_mentor AS
SELECT
    ma.project_id,
    cm.mentor_id,
    u.full_name AS mentor_name,
    u.email     AS mentor_email
FROM mentor_allocations ma
JOIN capstone_mentors cm ON cm.mentor_id = ma.mentor_id
JOIN users u             ON u.user_id    = cm.user_id
WHERE ma.mentor_role = 'Primary'
  AND ma.allocation_status = 'Active';

-- ---------------------------------------------------------------------
-- Mentor workload : active allocations vs capacity
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_mentor_workload AS
SELECT
    cm.mentor_id,
    cm.employee_id,
    u.full_name,
    u.email,
    cm.department,
    cm.designation,
    cm.max_projects,
    cm.availability_status,
    COUNT(ma.allocation_id)                                        AS active_allocations,
    COALESCE(SUM(ma.mentor_role = 'Primary'), 0)                   AS primary_count,
    COALESCE(SUM(ma.mentor_role = 'Co-Mentor'), 0)                 AS co_mentor_count,
    GREATEST(cm.max_projects - COUNT(ma.allocation_id), 0)         AS remaining_capacity,
    ROUND(COUNT(ma.allocation_id) * 100 / cm.max_projects, 1)      AS utilization_pct
FROM capstone_mentors cm
JOIN users u ON u.user_id = cm.user_id
LEFT JOIN mentor_allocations ma
       ON ma.mentor_id = cm.mentor_id AND ma.allocation_status = 'Active'
GROUP BY cm.mentor_id, cm.employee_id, u.full_name, u.email, cm.department,
         cm.designation, cm.max_projects, cm.availability_status;

-- ---------------------------------------------------------------------
-- Pending submissions : active project x milestone pairs with no submission yet
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pending_submissions AS
SELECT
    cp.project_id,
    cp.project_title,
    pg.group_id,
    pg.group_name,
    pg.academic_year,
    m.milestone_id,
    m.milestone_order,
    m.title           AS milestone_title,
    m.due_date,
    DATEDIFF(NOW(), m.due_date)        AS days_overdue,   -- negative = days remaining
    (m.due_date < NOW())               AS is_overdue,
    pm.mentor_name    AS primary_mentor_name
FROM capstone_projects cp
JOIN project_groups pg ON pg.group_id = cp.group_id
JOIN milestones m      ON m.academic_year = pg.academic_year
LEFT JOIN v_project_primary_mentor pm ON pm.project_id = cp.project_id
WHERE cp.project_status IN ('Approved', 'In Progress')
  AND NOT EXISTS (
        SELECT 1 FROM submissions s
        WHERE s.project_id = cp.project_id AND s.milestone_id = m.milestone_id
  );

-- ---------------------------------------------------------------------
-- Project progress : one row per project with milestone counts and state
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_project_progress AS
SELECT
    cp.project_id,
    cp.project_title,
    cp.project_status,
    cp.project_domain,
    pg.group_id,
    pg.group_name,
    pg.department,
    pg.academic_year,
    pm.mentor_name AS primary_mentor_name,
    (SELECT COUNT(*) FROM milestones m WHERE m.academic_year = pg.academic_year)            AS total_milestones,
    (SELECT COUNT(DISTINCT s.milestone_id) FROM submissions s WHERE s.project_id = cp.project_id) AS milestones_submitted,
    (SELECT COUNT(DISTINCT e.milestone_id) FROM evaluations e WHERE e.project_id = cp.project_id) AS milestones_evaluated,
    (SELECT COUNT(*) FROM v_pending_submissions ps
      WHERE ps.project_id = cp.project_id AND ps.is_overdue = 1)                             AS overdue_milestones,
    (SELECT COUNT(*) FROM submissions s
      WHERE s.project_id = cp.project_id AND s.version_no = 1 AND s.is_late = 1)              AS late_submissions, -- milestones whose first submission was late
    CASE
      WHEN (SELECT COUNT(*) FROM milestones m WHERE m.academic_year = pg.academic_year) = 0 THEN 0
      ELSE ROUND(
        (SELECT COUNT(DISTINCT s.milestone_id) FROM submissions s WHERE s.project_id = cp.project_id) * 100 /
        (SELECT COUNT(*) FROM milestones m WHERE m.academic_year = pg.academic_year), 1)
    END AS completion_pct,
    CASE
      WHEN cp.project_status = 'Completed'                              THEN 'Completed'
      WHEN cp.project_status IN ('Rejected', 'Cancelled')               THEN 'Closed'
      WHEN cp.project_status IN ('Proposed', 'Under Review')            THEN 'Pending'
      WHEN (SELECT COUNT(*) FROM v_pending_submissions ps
             WHERE ps.project_id = cp.project_id AND ps.is_overdue = 1) > 0 THEN 'Delayed'
      ELSE 'Active'
    END AS progress_state
FROM capstone_projects cp
JOIN project_groups pg ON pg.group_id = cp.group_id
LEFT JOIN v_project_primary_mentor pm ON pm.project_id = cp.project_id;

-- ---------------------------------------------------------------------
-- Milestone completion : per milestone, how many projects submitted / on time / late
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_milestone_completion AS
SELECT
    m.milestone_id,
    m.academic_year,
    m.milestone_order,
    m.title,
    m.due_date,
    m.max_marks,
    m.weightage,
    COUNT(DISTINCT cp.project_id)                                              AS eligible_projects,
    COUNT(DISTINCT s.project_id)                                               AS submitted_projects,
    -- on time / late is decided by the first submission (version 1)
    COUNT(DISTINCT CASE WHEN s.version_no = 1 AND s.is_late = 0 THEN s.project_id END) AS on_time_projects,
    COUNT(DISTINCT CASE WHEN s.version_no = 1 AND s.is_late = 1 THEN s.project_id END) AS late_projects,
    COUNT(DISTINCT cp.project_id) - COUNT(DISTINCT s.project_id)               AS pending_projects,
    COUNT(DISTINCT e.project_id)                                               AS evaluated_projects
FROM milestones m
LEFT JOIN project_groups pg     ON pg.academic_year = m.academic_year
LEFT JOIN capstone_projects cp  ON cp.group_id = pg.group_id
                               AND cp.project_status IN ('Approved', 'In Progress', 'Completed')
LEFT JOIN submissions s         ON s.milestone_id = m.milestone_id AND s.project_id = cp.project_id
LEFT JOIN evaluations e         ON e.milestone_id = m.milestone_id AND e.project_id = cp.project_id
GROUP BY m.milestone_id, m.academic_year, m.milestone_order, m.title, m.due_date, m.max_marks, m.weightage;

-- ---------------------------------------------------------------------
-- Student milestone marks : average across evaluators, scaled by weightage
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_student_milestone_marks AS
SELECT
    e.project_id,
    se.student_id,
    s.usn,
    u.full_name         AS student_name,
    m.milestone_id,
    m.milestone_order,
    m.title             AS milestone_title,
    m.max_marks,
    m.weightage,
    COUNT(*)                                             AS evaluator_count,
    ROUND(AVG(se.marks_awarded), 2)                      AS avg_marks,
    ROUND(AVG(se.marks_awarded) / m.max_marks * m.weightage, 2) AS weighted_marks
FROM student_evaluations se
JOIN evaluations e ON e.evaluation_id = se.evaluation_id
JOIN milestones m  ON m.milestone_id  = e.milestone_id
JOIN students s    ON s.student_id    = se.student_id
JOIN users u       ON u.user_id       = s.user_id
GROUP BY e.project_id, se.student_id, s.usn, u.full_name, m.milestone_id,
         m.milestone_order, m.title, m.max_marks, m.weightage;

-- ---------------------------------------------------------------------
-- Evaluation summary : per project per milestone
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_evaluation_summary AS
SELECT
    cp.project_id,
    cp.project_title,
    pg.group_name,
    m.milestone_id,
    m.milestone_order,
    m.title                                          AS milestone_title,
    m.max_marks,
    COUNT(DISTINCT e.evaluator_id)                   AS evaluator_count,
    ROUND(AVG(se.marks_awarded), 2)                  AS avg_marks,
    ROUND(AVG(se.marks_awarded) * 100 / m.max_marks, 1) AS avg_pct,
    MIN(se.marks_awarded)                            AS min_marks,
    MAX(se.marks_awarded)                            AS max_awarded
FROM evaluations e
JOIN capstone_projects cp ON cp.project_id = e.project_id
JOIN project_groups pg    ON pg.group_id   = cp.group_id
JOIN milestones m         ON m.milestone_id = e.milestone_id
LEFT JOIN student_evaluations se ON se.evaluation_id = e.evaluation_id
GROUP BY cp.project_id, cp.project_title, pg.group_name, m.milestone_id,
         m.milestone_order, m.title, m.max_marks;

-- ---------------------------------------------------------------------
-- Final results with names (populated by sp_calculate_final_marks)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_final_results AS
SELECT
    fr.project_id,
    cp.project_title,
    pg.group_name,
    fr.student_id,
    s.usn,
    u.full_name AS student_name,
    fr.weighted_total,
    fr.grade,
    fr.milestones_evaluated,
    fr.calculated_at
FROM final_results fr
JOIN capstone_projects cp ON cp.project_id = fr.project_id
JOIN project_groups pg    ON pg.group_id   = cp.group_id
JOIN students s           ON s.student_id  = fr.student_id
JOIN users u              ON u.user_id     = s.user_id;

-- ---------------------------------------------------------------------
-- Coordinator dashboard : single-row summary
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
    (SELECT COUNT(*) FROM v_project_progress)                                    AS total_projects,
    (SELECT COUNT(*) FROM v_project_progress WHERE progress_state = 'Active')    AS active_projects,
    (SELECT COUNT(*) FROM v_project_progress WHERE progress_state = 'Delayed')   AS delayed_projects,
    (SELECT COUNT(*) FROM v_project_progress WHERE progress_state = 'Pending')   AS pending_projects,
    (SELECT COUNT(*) FROM v_project_progress WHERE progress_state = 'Completed') AS completed_projects,
    (SELECT COUNT(*) FROM proposals WHERE proposal_status IN ('Submitted', 'Under Review')) AS proposals_awaiting_review,
    (SELECT COUNT(*) FROM v_pending_submissions WHERE is_overdue = 1)            AS overdue_submissions,
    (SELECT COUNT(*) FROM submissions WHERE submission_status IN ('Submitted', 'Under Review')) AS submissions_awaiting_review,
    (SELECT COUNT(*) FROM capstone_projects cp
       WHERE cp.project_status IN ('Approved', 'In Progress')
         AND NOT EXISTS (SELECT 1 FROM v_project_primary_mentor pm WHERE pm.project_id = cp.project_id)
    )                                                                            AS projects_without_guide;
