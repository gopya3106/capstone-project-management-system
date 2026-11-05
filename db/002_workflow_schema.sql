-- =====================================================================
-- CPMS - 002_workflow_schema.sql
-- Proposal -> Milestone -> Submission -> Evaluation -> Final result
-- plus notifications and supporting indexes.
--
-- Also upgrades a database created before this file existed:
--   * adds the 'Coordinator' role
--   * moves project_status to the synopsis lifecycle
--     (Proposed, Under Review, Approved, Rejected, In Progress, Completed
--      + On Hold / Cancelled kept for administrative use)
-- Safe to re-run.
-- =====================================================================

USE cpms_db;

-- ---------------------------------------------------------------------
-- Upgrade of pre-existing tables (no-ops on a fresh database)
-- ---------------------------------------------------------------------
ALTER TABLE users
  MODIFY role ENUM('Student', 'Mentor', 'Coordinator', 'Admin') NOT NULL;

-- widen first so old values remain valid, then migrate, then narrow
ALTER TABLE capstone_projects
  MODIFY project_status ENUM('Not Started', 'Proposed', 'Under Review', 'Approved', 'Rejected',
                             'In Progress', 'On Hold', 'Completed', 'Cancelled')
  NOT NULL DEFAULT 'Proposed';

UPDATE capstone_projects SET project_status = 'Proposed' WHERE project_status = 'Not Started';

ALTER TABLE capstone_projects
  MODIFY project_status ENUM('Proposed', 'Under Review', 'Approved', 'Rejected',
                             'In Progress', 'On Hold', 'Completed', 'Cancelled')
  NOT NULL DEFAULT 'Proposed';

-- ---------------------------------------------------------------------
-- PROPOSALS : versioned project proposals submitted by a group
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposals (
    proposal_id       INT AUTO_INCREMENT PRIMARY KEY,
    group_id          INT           NOT NULL,
    submitted_by      INT           NOT NULL,                 -- student_id
    version_no        SMALLINT UNSIGNED NOT NULL DEFAULT 1,  -- set by trigger
    title             VARCHAR(200)  NOT NULL,
    abstract          TEXT          NOT NULL,
    objectives        TEXT          NULL,
    methodology       TEXT          NULL,
    technology_stack  VARCHAR(255)  NULL,
    project_domain    VARCHAR(80)   NULL,
    proposal_status   ENUM('Submitted', 'Under Review', 'Approved', 'Rejected') NOT NULL DEFAULT 'Submitted',
    submitted_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by       INT           NULL,                     -- user_id of coordinator/admin
    reviewed_at       TIMESTAMP     NULL,
    review_comments   VARCHAR(1000) NULL,
    CONSTRAINT uq_proposal_version UNIQUE (group_id, version_no),
    CONSTRAINT fk_prop_group    FOREIGN KEY (group_id)
        REFERENCES project_groups (group_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_prop_student  FOREIGN KEY (submitted_by)
        REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_prop_reviewer FOREIGN KEY (reviewed_by)
        REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_prop_title CHECK (CHAR_LENGTH(TRIM(title)) >= 5),
    INDEX idx_prop_status (proposal_status, submitted_at)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- MILESTONES : review checkpoints defined by the coordinator per academic year
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS milestones (
    milestone_id     INT AUTO_INCREMENT PRIMARY KEY,
    academic_year    VARCHAR(9)    NOT NULL,
    milestone_order  TINYINT UNSIGNED NOT NULL,
    title            VARCHAR(120)  NOT NULL,
    description      VARCHAR(1000) NULL,
    due_date         DATETIME      NOT NULL,
    max_marks        DECIMAL(5,2)  NOT NULL,
    weightage        DECIMAL(5,2)  NOT NULL,                  -- % of final mark
    created_by       INT           NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_milestone_order UNIQUE (academic_year, milestone_order),
    CONSTRAINT fk_ms_creator FOREIGN KEY (created_by)
        REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_ms_marks     CHECK (max_marks > 0 AND max_marks <= 500),
    CONSTRAINT chk_ms_weightage CHECK (weightage > 0 AND weightage <= 100),
    INDEX idx_ms_due (due_date)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- SUBMISSIONS : documents a group submits against a milestone (versioned)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
    submission_id      INT AUTO_INCREMENT PRIMARY KEY,
    project_id         INT           NOT NULL,
    milestone_id       INT           NOT NULL,
    submitted_by       INT           NOT NULL,                -- student_id
    version_no         SMALLINT UNSIGNED NOT NULL DEFAULT 1, -- set by trigger
    document_title     VARCHAR(200)  NOT NULL,
    document_url       VARCHAR(500)  NOT NULL,
    notes              VARCHAR(1000) NULL,
    submitted_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_late            BOOLEAN       NOT NULL DEFAULT FALSE,  -- set by trigger
    submission_status  ENUM('Submitted', 'Under Review', 'Accepted', 'Revision Requested')
                       NOT NULL DEFAULT 'Submitted',
    reviewed_by        INT           NULL,                    -- mentor_id
    reviewed_at        TIMESTAMP     NULL,
    feedback           VARCHAR(2000) NULL,
    CONSTRAINT uq_submission_version UNIQUE (project_id, milestone_id, version_no),
    CONSTRAINT fk_sub_project   FOREIGN KEY (project_id)
        REFERENCES capstone_projects (project_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sub_milestone FOREIGN KEY (milestone_id)
        REFERENCES milestones (milestone_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sub_student   FOREIGN KEY (submitted_by)
        REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_sub_reviewer  FOREIGN KEY (reviewed_by)
        REFERENCES capstone_mentors (mentor_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_sub_url CHECK (document_url LIKE 'http://%' OR document_url LIKE 'https://%'),
    INDEX idx_sub_milestone (milestone_id, project_id),
    INDEX idx_sub_late (is_late),
    INDEX idx_sub_status (submission_status)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- EVALUATIONS : one evaluator's review of one project at one milestone
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluations (
    evaluation_id  INT AUTO_INCREMENT PRIMARY KEY,
    project_id     INT           NOT NULL,
    milestone_id   INT           NOT NULL,
    evaluator_id   INT           NOT NULL,                    -- mentor_id
    comments       VARCHAR(2000) NULL,
    evaluated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_evaluation UNIQUE (project_id, milestone_id, evaluator_id),
    CONSTRAINT fk_eval_project   FOREIGN KEY (project_id)
        REFERENCES capstone_projects (project_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_eval_milestone FOREIGN KEY (milestone_id)
        REFERENCES milestones (milestone_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_eval_mentor    FOREIGN KEY (evaluator_id)
        REFERENCES capstone_mentors (mentor_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- STUDENT_EVALUATIONS : individual marks for each student in an evaluation
-- (marks depend on evaluation + student, so they live here, not in evaluations)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_evaluations (
    student_evaluation_id  INT AUTO_INCREMENT PRIMARY KEY,
    evaluation_id          INT           NOT NULL,
    student_id             INT           NOT NULL,
    marks_awarded          DECIMAL(5,2)  NOT NULL,
    remarks                VARCHAR(500)  NULL,
    CONSTRAINT uq_student_evaluation UNIQUE (evaluation_id, student_id),
    CONSTRAINT fk_se_eval    FOREIGN KEY (evaluation_id)
        REFERENCES evaluations (evaluation_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_se_student FOREIGN KEY (student_id)
        REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_se_marks CHECK (marks_awarded >= 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- FINAL_RESULTS : output of sp_calculate_final_marks (one row per student/project)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS final_results (
    project_id            INT           NOT NULL,
    student_id            INT           NOT NULL,
    weighted_total        DECIMAL(5,2)  NOT NULL,             -- out of 100
    grade                 CHAR(2)       NOT NULL,
    milestones_evaluated  TINYINT UNSIGNED NOT NULL,
    calculated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, student_id),
    CONSTRAINT fk_fr_project FOREIGN KEY (project_id)
        REFERENCES capstone_projects (project_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_fr_student FOREIGN KEY (student_id)
        REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_fr_total CHECK (weighted_total BETWEEN 0 AND 100)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- NOTIFICATIONS : in-app messages (mostly written by triggers)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    notification_id  INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT           NOT NULL,
    title            VARCHAR(150)  NOT NULL,
    message          VARCHAR(500)  NOT NULL,
    link             VARCHAR(255)  NULL,
    is_read          BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_notif_user (user_id, is_read, created_at)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Secondary indexes on core tables (added idempotently)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS cpms_add_index;

DELIMITER $$
CREATE PROCEDURE cpms_add_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_columns VARCHAR(255))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = p_table AND index_name = p_index
  ) THEN
    SET @ddl = CONCAT('CREATE INDEX ', p_index, ' ON ', p_table, ' (', p_columns, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL cpms_add_index('capstone_projects',  'idx_proj_status',        'project_status');
CALL cpms_add_index('capstone_projects',  'idx_proj_domain',        'project_domain');
CALL cpms_add_index('mentor_allocations', 'idx_alloc_mentor_status', 'mentor_id, allocation_status');
CALL cpms_add_index('mentor_allocations', 'idx_alloc_project_role',  'project_id, mentor_role, allocation_status');
CALL cpms_add_index('group_members',      'idx_gm_student_status',   'student_id, membership_status');
CALL cpms_add_index('project_groups',     'idx_groups_year_status',  'academic_year, group_status');
CALL cpms_add_index('students',           'idx_students_dept_batch', 'department, batch');

DROP PROCEDURE IF EXISTS cpms_add_index;
