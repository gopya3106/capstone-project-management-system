-- =====================================================================
-- CPMS - 004_triggers_procedures.sql
-- Business rules enforced inside the database:
--   functions : fn_grade
--   procedures: sp_allocate_guide, sp_review_proposal, sp_calculate_final_marks
--   triggers  : proposal versioning/validation + notifications,
--               milestone weightage cap, submission versioning + late detection,
--               marks validation, evaluator authorisation, mentor capacity guard
--
-- Uses DELIMITER, so run it with the mysql CLI, MySQL Workbench,
-- or `npm run db:setup` (which understands DELIMITER).
-- Safe to re-run (DROP ... IF EXISTS first).
-- =====================================================================

USE cpms_db;

-- =====================================================================
-- FUNCTIONS
-- =====================================================================
DROP FUNCTION IF EXISTS fn_grade;

DELIMITER $$
CREATE FUNCTION fn_grade(p_score DECIMAL(5,2))
RETURNS CHAR(2)
DETERMINISTIC NO SQL
BEGIN
  RETURN CASE
    WHEN p_score >= 90 THEN 'O'
    WHEN p_score >= 80 THEN 'A+'
    WHEN p_score >= 70 THEN 'A'
    WHEN p_score >= 60 THEN 'B+'
    WHEN p_score >= 50 THEN 'B'
    WHEN p_score >= 40 THEN 'C'
    ELSE 'F'
  END;
END$$
DELIMITER ;

-- =====================================================================
-- STORED PROCEDURES
-- =====================================================================

-- ---------------------------------------------------------------------
-- sp_allocate_guide : assign a Primary / Co-Mentor guide to a project.
--   * mentor must be Available and below max_projects
--   * a mentor cannot be active twice on the same project
--   * assigning a new Primary ends the previous Primary (atomically)
--   * a previously ended allocation is re-activated (uq_project_mentor)
-- Runs inside its own transaction; rolls back on any error.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_allocate_guide;

DELIMITER $$
CREATE PROCEDURE sp_allocate_guide(
  IN  p_project_id   INT,
  IN  p_mentor_id    INT,
  IN  p_mentor_role  VARCHAR(10),
  IN  p_allocated_by INT,
  IN  p_remarks      VARCHAR(500),
  OUT p_allocation_id INT
)
BEGIN
  DECLARE v_msg            VARCHAR(255);
  DECLARE v_max            INT;
  DECLARE v_availability   VARCHAR(20);
  DECLARE v_active_count   INT;
  DECLARE v_existing_id    INT DEFAULT NULL;
  DECLARE v_existing_state VARCHAR(10);
  DECLARE v_existing_role  VARCHAR(10);
  DECLARE v_found          INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_mentor_role NOT IN ('Primary', 'Co-Mentor') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mentor role must be Primary or Co-Mentor.';
  END IF;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_found FROM capstone_projects WHERE project_id = p_project_id FOR UPDATE;
  IF v_found = 0 THEN
    SET v_msg = CONCAT('Project with ID ', p_project_id, ' not found.');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;

  SELECT COUNT(*) INTO v_found FROM capstone_mentors WHERE mentor_id = p_mentor_id;
  IF v_found = 0 THEN
    SET v_msg = CONCAT('Mentor with ID ', p_mentor_id, ' not found.');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;

  SELECT max_projects, availability_status INTO v_max, v_availability
  FROM capstone_mentors WHERE mentor_id = p_mentor_id FOR UPDATE;

  IF v_availability <> 'Available' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mentor is currently marked as Unavailable.';
  END IF;

  SELECT allocation_id, allocation_status, mentor_role
    INTO v_existing_id, v_existing_state, v_existing_role
  FROM mentor_allocations
  WHERE project_id = p_project_id AND mentor_id = p_mentor_id
  FOR UPDATE;

  IF v_existing_id IS NOT NULL AND v_existing_state = 'Active' THEN
    SET v_msg = CONCAT('This mentor is already actively assigned as ', v_existing_role, ' to this project.');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM mentor_allocations WHERE mentor_id = p_mentor_id AND allocation_status = 'Active';

  IF v_active_count >= v_max THEN
    SET v_msg = CONCAT('Mentor has reached maximum workload capacity (', v_active_count, '/', v_max, ' active projects).');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;

  IF p_mentor_role = 'Primary' THEN
    UPDATE mentor_allocations
       SET allocation_status = 'Ended',
           end_date = CURDATE(),
           remarks = CONCAT(COALESCE(remarks, ''), ' [Replaced by new Primary Mentor]')
     WHERE project_id = p_project_id AND mentor_role = 'Primary' AND allocation_status = 'Active';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE mentor_allocations
       SET mentor_role = p_mentor_role,
           allocation_status = 'Active',
           allocation_date = CURDATE(),
           end_date = NULL,
           allocated_by = p_allocated_by,
           remarks = p_remarks
     WHERE allocation_id = v_existing_id;
    SET p_allocation_id = v_existing_id;
  ELSE
    INSERT INTO mentor_allocations (project_id, mentor_id, allocated_by, allocation_date,
                                    mentor_role, allocation_status, remarks)
    VALUES (p_project_id, p_mentor_id, p_allocated_by, CURDATE(), p_mentor_role, 'Active', p_remarks);
    SET p_allocation_id = LAST_INSERT_ID();
  END IF;

  COMMIT;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- sp_review_proposal : coordinator approves / rejects / marks under review.
--   Approved -> creates the group's capstone_projects row (or updates it)
--               with status 'Approved'
--   Rejected -> project (if any, and not yet started) becomes 'Rejected'
--   Under Review -> project (if any) becomes 'Under Review'
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_review_proposal;

DELIMITER $$
CREATE PROCEDURE sp_review_proposal(
  IN p_proposal_id INT,
  IN p_reviewer_id INT,
  IN p_decision    VARCHAR(20),
  IN p_comments    VARCHAR(1000)
)
BEGIN
  DECLARE v_status    VARCHAR(20);
  DECLARE v_group_id  INT;
  DECLARE v_title     VARCHAR(200);
  DECLARE v_abstract  TEXT;
  DECLARE v_obj       TEXT;
  DECLARE v_method    TEXT;
  DECLARE v_stack     VARCHAR(255);
  DECLARE v_domain    VARCHAR(80);
  DECLARE v_project   INT DEFAULT NULL;
  DECLARE v_proj_stat VARCHAR(20);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_decision NOT IN ('Under Review', 'Approved', 'Rejected') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Decision must be Under Review, Approved or Rejected.';
  END IF;

  IF p_decision = 'Rejected' AND (p_comments IS NULL OR CHAR_LENGTH(TRIM(p_comments)) = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review comments are required when rejecting a proposal.';
  END IF;

  START TRANSACTION;

  SELECT proposal_status, group_id, title, abstract, objectives, methodology, technology_stack, project_domain
    INTO v_status, v_group_id, v_title, v_abstract, v_obj, v_method, v_stack, v_domain
  FROM proposals WHERE proposal_id = p_proposal_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Proposal not found.';
  END IF;

  IF v_status IN ('Approved', 'Rejected') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This proposal has already been reviewed.';
  END IF;

  UPDATE proposals
     SET proposal_status = p_decision,
         reviewed_by     = p_reviewer_id,
         reviewed_at     = CASE WHEN p_decision = 'Under Review' THEN NULL ELSE CURRENT_TIMESTAMP END,
         review_comments = p_comments
   WHERE proposal_id = p_proposal_id;

  SELECT project_id, project_status INTO v_project, v_proj_stat
  FROM capstone_projects WHERE group_id = v_group_id FOR UPDATE;

  IF p_decision = 'Approved' THEN
    IF v_project IS NULL THEN
      INSERT INTO capstone_projects (group_id, project_title, problem_statement, objectives,
                                     proposed_methodology, technology_stack, project_domain,
                                     current_phase_id, project_status, start_date)
      VALUES (v_group_id, v_title, v_abstract, v_obj, v_method, v_stack, v_domain,
              1, 'Approved', CURDATE());
    ELSE
      UPDATE capstone_projects
         SET project_title        = v_title,
             problem_statement    = v_abstract,
             objectives           = COALESCE(v_obj, objectives),
             proposed_methodology = COALESCE(v_method, proposed_methodology),
             technology_stack     = COALESCE(v_stack, technology_stack),
             project_domain       = COALESCE(v_domain, project_domain),
             project_status       = CASE WHEN project_status IN ('In Progress', 'Completed')
                                         THEN project_status ELSE 'Approved' END,
             start_date           = COALESCE(start_date, CURDATE())
       WHERE project_id = v_project;
    END IF;
  ELSEIF v_project IS NOT NULL AND v_proj_stat IN ('Proposed', 'Under Review') THEN
    UPDATE capstone_projects SET project_status = p_decision WHERE project_id = v_project;
  END IF;

  COMMIT;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- sp_calculate_final_marks : weighted total (out of 100) + grade for each
-- active member of a project; upserts final_results and returns the rows.
--   milestone score = AVG(marks across evaluators) / max_marks * weightage
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_calculate_final_marks;

DELIMITER $$
CREATE PROCEDURE sp_calculate_final_marks(IN p_project_id INT)
BEGIN
  DECLARE v_group_id INT;
  DECLARE v_total_ms INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT group_id INTO v_group_id FROM capstone_projects WHERE project_id = p_project_id;
  IF v_group_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Project not found.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM evaluations WHERE project_id = p_project_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No evaluations recorded for this project yet.';
  END IF;

  SELECT COUNT(*) INTO v_total_ms
  FROM milestones m JOIN project_groups pg ON pg.academic_year = m.academic_year
  WHERE pg.group_id = v_group_id;

  START TRANSACTION;

  -- grade is 'IP' (in progress) until every milestone of the year is evaluated
  INSERT INTO final_results (project_id, student_id, weighted_total, grade, milestones_evaluated)
  SELECT
      p_project_id,
      gm.student_id,
      LEAST(ROUND(COALESCE(SUM(sm.weighted_marks), 0), 2), 100),
      CASE WHEN COUNT(sm.milestone_id) < v_total_ms THEN 'IP'
           ELSE fn_grade(LEAST(ROUND(COALESCE(SUM(sm.weighted_marks), 0), 2), 100)) END,
      COUNT(sm.milestone_id)
  FROM group_members gm
  LEFT JOIN v_student_milestone_marks sm
         ON sm.student_id = gm.student_id AND sm.project_id = p_project_id
  WHERE gm.group_id = v_group_id AND gm.membership_status = 'Active'
  GROUP BY gm.student_id
  ON DUPLICATE KEY UPDATE
      weighted_total       = VALUES(weighted_total),
      grade                = VALUES(grade),
      milestones_evaluated = VALUES(milestones_evaluated),
      calculated_at        = CURRENT_TIMESTAMP;

  COMMIT;

  SELECT * FROM v_final_results WHERE project_id = p_project_id ORDER BY usn;
END$$
DELIMITER ;

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Proposals: only active group members may submit; one pending proposal
-- at a time; no new proposal once one is approved; auto version number.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_proposals_before_insert;

DELIMITER $$
CREATE TRIGGER trg_proposals_before_insert
BEFORE INSERT ON proposals
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = NEW.group_id AND student_id = NEW.submitted_by AND membership_status = 'Active'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an active member of the group can submit its proposal.';
  END IF;

  IF EXISTS (SELECT 1 FROM proposals WHERE group_id = NEW.group_id AND proposal_status = 'Approved') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This group already has an approved proposal.';
  END IF;

  IF EXISTS (SELECT 1 FROM proposals
             WHERE group_id = NEW.group_id AND proposal_status IN ('Submitted', 'Under Review')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A proposal from this group is already awaiting review.';
  END IF;

  SET NEW.version_no = (SELECT COALESCE(MAX(version_no), 0) + 1 FROM proposals WHERE group_id = NEW.group_id);
  SET NEW.proposal_status = 'Submitted';
END$$
DELIMITER ;

-- New proposal -> move project (if any) to 'Proposed' and notify coordinators
DROP TRIGGER IF EXISTS trg_proposals_after_insert;

DELIMITER $$
CREATE TRIGGER trg_proposals_after_insert
AFTER INSERT ON proposals
FOR EACH ROW
BEGIN
  UPDATE capstone_projects
     SET project_status = 'Proposed'
   WHERE group_id = NEW.group_id AND project_status = 'Rejected';

  INSERT INTO notifications (user_id, title, message, link)
  SELECT u.user_id,
         'New proposal submitted',
         CONCAT('"', NEW.title, '" (version ', NEW.version_no, ') is awaiting review.'),
         '/dashboard/admin/proposals'
  FROM users u
  WHERE u.role IN ('Coordinator', 'Admin') AND u.account_status = 'Active';
END$$
DELIMITER ;

-- Proposal decision -> notify every active member of the group
DROP TRIGGER IF EXISTS trg_proposals_after_update;

DELIMITER $$
CREATE TRIGGER trg_proposals_after_update
AFTER UPDATE ON proposals
FOR EACH ROW
BEGIN
  IF NEW.proposal_status <> OLD.proposal_status THEN
    INSERT INTO notifications (user_id, title, message, link)
    SELECT s.user_id,
           CONCAT('Proposal ', LOWER(NEW.proposal_status)),
           CONCAT('Your proposal "', NEW.title, '" is now ', NEW.proposal_status,
                  CASE WHEN NEW.review_comments IS NULL THEN '.' ELSE CONCAT(': ', LEFT(NEW.review_comments, 200)) END),
           '/dashboard/student'
    FROM group_members gm
    JOIN students s ON s.student_id = gm.student_id
    WHERE gm.group_id = NEW.group_id AND gm.membership_status = 'Active';
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Milestones: total weightage of an academic year may not exceed 100 %
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_milestones_before_insert;
DROP TRIGGER IF EXISTS trg_milestones_before_update;

DELIMITER $$
CREATE TRIGGER trg_milestones_before_insert
BEFORE INSERT ON milestones
FOR EACH ROW
BEGIN
  DECLARE v_total DECIMAL(6,2);
  DECLARE v_msg VARCHAR(255);
  SELECT COALESCE(SUM(weightage), 0) INTO v_total FROM milestones WHERE academic_year = NEW.academic_year;
  IF v_total + NEW.weightage > 100 THEN
    SET v_msg = CONCAT('Total milestone weightage for ', NEW.academic_year, ' would exceed 100% (currently ', v_total, '%).');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;
END$$

CREATE TRIGGER trg_milestones_before_update
BEFORE UPDATE ON milestones
FOR EACH ROW
BEGIN
  DECLARE v_total DECIMAL(6,2);
  DECLARE v_msg VARCHAR(255);
  SELECT COALESCE(SUM(weightage), 0) INTO v_total
  FROM milestones WHERE academic_year = NEW.academic_year AND milestone_id <> OLD.milestone_id;
  IF v_total + NEW.weightage > 100 THEN
    SET v_msg = CONCAT('Total milestone weightage for ', NEW.academic_year, ' would exceed 100% (currently ', v_total, '% excluding this milestone).');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Submissions: validate submitter + project state, auto version number,
-- and flag late submissions against the milestone due date.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_submissions_before_insert;

DELIMITER $$
CREATE TRIGGER trg_submissions_before_insert
BEFORE INSERT ON submissions
FOR EACH ROW
BEGIN
  DECLARE v_due        DATETIME;
  DECLARE v_status     VARCHAR(20);
  DECLARE v_group_id   INT;
  DECLARE v_group_year VARCHAR(9);
  DECLARE v_ms_year    VARCHAR(9);

  SELECT cp.project_status, cp.group_id, pg.academic_year
    INTO v_status, v_group_id, v_group_year
  FROM capstone_projects cp JOIN project_groups pg ON pg.group_id = cp.group_id
  WHERE cp.project_id = NEW.project_id;

  SELECT due_date, academic_year INTO v_due, v_ms_year
  FROM milestones WHERE milestone_id = NEW.milestone_id;

  IF v_status NOT IN ('Approved', 'In Progress') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submissions are only accepted for Approved or In Progress projects.';
  END IF;

  IF v_ms_year <> v_group_year THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This milestone does not belong to the group''s academic year.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = v_group_id AND student_id = NEW.submitted_by AND membership_status = 'Active'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an active member of the project group can submit.';
  END IF;

  IF NEW.submitted_at IS NULL THEN
    SET NEW.submitted_at = CURRENT_TIMESTAMP;
  END IF;

  SET NEW.version_no = (
    SELECT COALESCE(MAX(version_no), 0) + 1 FROM submissions
    WHERE project_id = NEW.project_id AND milestone_id = NEW.milestone_id
  );
  SET NEW.is_late = (NEW.submitted_at > v_due);
  SET NEW.submission_status = 'Submitted';
END$$
DELIMITER ;

-- First submission moves an Approved project to In Progress; notify guides
DROP TRIGGER IF EXISTS trg_submissions_after_insert;

DELIMITER $$
CREATE TRIGGER trg_submissions_after_insert
AFTER INSERT ON submissions
FOR EACH ROW
BEGIN
  UPDATE capstone_projects
     SET project_status = 'In Progress',
         current_phase_id = GREATEST(COALESCE(current_phase_id, 1), 2)
   WHERE project_id = NEW.project_id AND project_status = 'Approved';

  INSERT INTO notifications (user_id, title, message, link)
  SELECT cm.user_id,
         CASE WHEN NEW.is_late THEN 'Late submission received' ELSE 'New submission received' END,
         CONCAT('"', NEW.document_title, '" (v', NEW.version_no, ') was submitted',
                CASE WHEN NEW.is_late THEN ' after the due date.' ELSE '.' END),
         '/dashboard/mentor'
  FROM mentor_allocations ma
  JOIN capstone_mentors cm ON cm.mentor_id = ma.mentor_id
  WHERE ma.project_id = NEW.project_id AND ma.allocation_status = 'Active';
END$$
DELIMITER ;

-- Review outcome -> notify the group
DROP TRIGGER IF EXISTS trg_submissions_after_update;

DELIMITER $$
CREATE TRIGGER trg_submissions_after_update
AFTER UPDATE ON submissions
FOR EACH ROW
BEGIN
  IF NEW.submission_status <> OLD.submission_status THEN
    INSERT INTO notifications (user_id, title, message, link)
    SELECT s.user_id,
           CONCAT('Submission ', LOWER(NEW.submission_status)),
           CONCAT('"', NEW.document_title, '" (v', NEW.version_no, ') was marked ', NEW.submission_status, '.'),
           '/dashboard/student'
    FROM capstone_projects cp
    JOIN group_members gm ON gm.group_id = cp.group_id AND gm.membership_status = 'Active'
    JOIN students s ON s.student_id = gm.student_id
    WHERE cp.project_id = NEW.project_id;
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Evaluations: only a mentor actively allocated to the project may evaluate
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_evaluations_before_insert;

DELIMITER $$
CREATE TRIGGER trg_evaluations_before_insert
BEFORE INSERT ON evaluations
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM mentor_allocations
    WHERE project_id = NEW.project_id AND mentor_id = NEW.evaluator_id AND allocation_status = 'Active'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only a mentor allocated to this project can evaluate it.';
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Student evaluations: marks within 0..max_marks and student in the group
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_student_evaluations_before_insert;
DROP TRIGGER IF EXISTS trg_student_evaluations_before_update;

DELIMITER $$
CREATE TRIGGER trg_student_evaluations_before_insert
BEFORE INSERT ON student_evaluations
FOR EACH ROW
BEGIN
  DECLARE v_max DECIMAL(5,2);
  DECLARE v_group_id INT;
  DECLARE v_msg VARCHAR(255);

  SELECT m.max_marks, cp.group_id INTO v_max, v_group_id
  FROM evaluations e
  JOIN milestones m ON m.milestone_id = e.milestone_id
  JOIN capstone_projects cp ON cp.project_id = e.project_id
  WHERE e.evaluation_id = NEW.evaluation_id;

  IF NEW.marks_awarded < 0 OR NEW.marks_awarded > v_max THEN
    SET v_msg = CONCAT('Marks must be between 0 and ', v_max, ' for this milestone.');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = v_group_id AND student_id = NEW.student_id AND membership_status = 'Active'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Marks can only be given to active members of the project group.';
  END IF;
END$$

CREATE TRIGGER trg_student_evaluations_before_update
BEFORE UPDATE ON student_evaluations
FOR EACH ROW
BEGIN
  DECLARE v_max DECIMAL(5,2);
  DECLARE v_msg VARCHAR(255);

  SELECT m.max_marks INTO v_max
  FROM evaluations e JOIN milestones m ON m.milestone_id = e.milestone_id
  WHERE e.evaluation_id = NEW.evaluation_id;

  IF NEW.marks_awarded < 0 OR NEW.marks_awarded > v_max THEN
    SET v_msg = CONCAT('Marks must be between 0 and ', v_max, ' for this milestone.');
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Mentor allocations: capacity guard at database level (defence in depth,
-- in case a row is written without going through sp_allocate_guide)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_allocations_before_insert;
DROP TRIGGER IF EXISTS trg_allocations_before_update;

DELIMITER $$
CREATE TRIGGER trg_allocations_before_insert
BEFORE INSERT ON mentor_allocations
FOR EACH ROW
BEGIN
  DECLARE v_active INT;
  DECLARE v_max INT;
  IF NEW.allocation_status = 'Active' THEN
    SELECT COUNT(*) INTO v_active FROM mentor_allocations
    WHERE mentor_id = NEW.mentor_id AND allocation_status = 'Active';
    SELECT max_projects INTO v_max FROM capstone_mentors WHERE mentor_id = NEW.mentor_id;
    IF v_active >= v_max THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mentor has reached maximum workload capacity.';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_allocations_before_update
BEFORE UPDATE ON mentor_allocations
FOR EACH ROW
BEGIN
  DECLARE v_active INT;
  DECLARE v_max INT;
  IF NEW.allocation_status = 'Active' AND OLD.allocation_status <> 'Active' THEN
    SELECT COUNT(*) INTO v_active FROM mentor_allocations
    WHERE mentor_id = NEW.mentor_id AND allocation_status = 'Active';
    SELECT max_projects INTO v_max FROM capstone_mentors WHERE mentor_id = NEW.mentor_id;
    IF v_active >= v_max THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mentor has reached maximum workload capacity.';
    END IF;
  END IF;
END$$
DELIMITER ;
