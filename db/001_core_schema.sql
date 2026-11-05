-- =====================================================================
-- CPMS - Capstone Project Management System
-- 001_core_schema.sql : Core entities (users, students, faculty, groups,
--                       projects, phases, guide allocation)
--
-- Target: MySQL 8.0.16+ (CHECK constraints are enforced from 8.0.16)
-- All tables are in Third Normal Form (3NF):
--   * every non-key attribute depends on the whole key and only the key
--   * derived values (workload, member counts, marks) are computed through
--     views / queries, not stored redundantly (team_size is the single
--     documented exception, kept in sync by the application transaction)
--
-- Safe to re-run: every object uses IF NOT EXISTS.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS cpms_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE cpms_db;

-- ---------------------------------------------------------------------
-- USERS : one login account per person (Admin / Coordinator / Mentor / Student)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id         INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(120)  NOT NULL,
    email           VARCHAR(255)  NOT NULL,
    password_hash   VARCHAR(255)  NOT NULL,
    role            ENUM('Student', 'Mentor', 'Coordinator', 'Admin') NOT NULL,
    phone_number    VARCHAR(20)   NULL,
    account_status  ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_email CHECK (email LIKE '%_@_%._%')
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- STUDENTS : academic profile (1:1 with users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    student_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id           INT           NOT NULL,
    usn               VARCHAR(20)   NOT NULL,
    department        VARCHAR(50)   NOT NULL,
    specialization    VARCHAR(100)  NULL,
    batch             VARCHAR(20)   NOT NULL,           -- e.g. 2023-2027
    current_semester  TINYINT       NULL,
    section           VARCHAR(5)    NULL,
    cgpa              DECIMAL(4,2)  NULL,
    academic_status   ENUM('Active', 'Inactive', 'Graduated') NOT NULL DEFAULT 'Active',
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_students_user UNIQUE (user_id),
    CONSTRAINT uq_students_usn  UNIQUE (usn),
    CONSTRAINT fk_students_user FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_students_semester CHECK (current_semester IS NULL OR current_semester BETWEEN 1 AND 8),
    CONSTRAINT chk_students_cgpa     CHECK (cgpa IS NULL OR cgpa BETWEEN 0 AND 10)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- CAPSTONE_MENTORS : faculty guides / evaluators (1:1 with users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capstone_mentors (
    mentor_id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id              INT           NOT NULL,
    employee_id          VARCHAR(20)   NOT NULL,
    department           VARCHAR(50)   NOT NULL,
    designation          VARCHAR(60)   NULL,
    specialization       VARCHAR(150)  NULL,
    years_of_experience  TINYINT UNSIGNED NOT NULL DEFAULT 0,
    max_projects         TINYINT UNSIGNED NOT NULL DEFAULT 4,
    availability_status  ENUM('Available', 'Unavailable') NOT NULL DEFAULT 'Available',
    office_location      VARCHAR(60)   NULL,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_mentors_user     UNIQUE (user_id),
    CONSTRAINT uq_mentors_employee UNIQUE (employee_id),
    CONSTRAINT fk_mentors_user FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_mentors_capacity CHECK (max_projects BETWEEN 1 AND 15)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- PROJECT_GROUPS : a capstone team
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_groups (
    group_id        INT AUTO_INCREMENT PRIMARY KEY,
    group_name      VARCHAR(100)  NOT NULL,
    batch           VARCHAR(20)   NOT NULL,
    department      VARCHAR(50)   NOT NULL,
    academic_year   VARCHAR(9)    NOT NULL,             -- e.g. 2026-2027
    formation_date  DATE          NOT NULL,
    team_leader_id  INT           NULL,
    team_size       TINYINT UNSIGNED NOT NULL DEFAULT 1,
    group_status    ENUM('Forming', 'Active', 'Completed', 'Disbanded') NOT NULL DEFAULT 'Forming',
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_groups_name_year UNIQUE (group_name, academic_year),
    CONSTRAINT fk_groups_leader FOREIGN KEY (team_leader_id)
        REFERENCES students (student_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_groups_size CHECK (team_size BETWEEN 1 AND 4)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- GROUP_MEMBERS : resolves the M:N between students and groups (with history)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_members (
    group_member_id    INT AUTO_INCREMENT PRIMARY KEY,
    group_id           INT        NOT NULL,
    student_id         INT        NOT NULL,
    member_role        ENUM('Leader', 'Member') NOT NULL DEFAULT 'Member',
    membership_status  ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    joined_at          TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at            TIMESTAMP  NULL,
    CONSTRAINT uq_group_student UNIQUE (group_id, student_id),
    CONSTRAINT fk_gm_group   FOREIGN KEY (group_id)
        REFERENCES project_groups (group_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_gm_student FOREIGN KEY (student_id)
        REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_gm_left CHECK (left_at IS NULL OR left_at >= joined_at)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- CAPSTONE_PHASES : lookup table of lifecycle phases
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capstone_phases (
    phase_id      INT AUTO_INCREMENT PRIMARY KEY,
    phase_number  TINYINT UNSIGNED NOT NULL,
    phase_name    VARCHAR(80)   NOT NULL,
    description   VARCHAR(255)  NULL,
    CONSTRAINT uq_phase_number UNIQUE (phase_number)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- CAPSTONE_PROJECTS : the official project (1:1 with group)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capstone_projects (
    project_id            INT AUTO_INCREMENT PRIMARY KEY,
    group_id              INT           NOT NULL,
    project_title         VARCHAR(200)  NOT NULL,
    problem_statement     TEXT          NULL,
    objectives            TEXT          NULL,
    scope                 TEXT          NULL,
    project_domain        VARCHAR(80)   NULL,
    project_type          VARCHAR(50)   NULL,
    proposed_methodology  TEXT          NULL,
    technology_stack      VARCHAR(255)  NULL,
    current_phase_id      INT           NULL DEFAULT 1,
    project_status        ENUM('Proposed', 'Under Review', 'Approved', 'Rejected',
                               'In Progress', 'On Hold', 'Completed', 'Cancelled')
                          NOT NULL DEFAULT 'Proposed',
    start_date            DATE          NULL,
    expected_end_date     DATE          NULL,
    completion_date       DATE          NULL,
    repository_url        VARCHAR(255)  NULL,
    created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_projects_group UNIQUE (group_id),
    CONSTRAINT fk_projects_group FOREIGN KEY (group_id)
        REFERENCES project_groups (group_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_projects_phase FOREIGN KEY (current_phase_id)
        REFERENCES capstone_phases (phase_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_projects_dates CHECK (expected_end_date IS NULL OR start_date IS NULL OR expected_end_date >= start_date),
    CONSTRAINT chk_projects_completion CHECK (completion_date IS NULL OR start_date IS NULL OR completion_date >= start_date)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- MENTOR_ALLOCATIONS : Guide_Allocation (M:N between faculty and projects)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mentor_allocations (
    allocation_id      INT AUTO_INCREMENT PRIMARY KEY,
    project_id         INT          NOT NULL,
    mentor_id          INT          NOT NULL,
    allocated_by       INT          NULL,
    allocation_date    DATE         NOT NULL,
    mentor_role        ENUM('Primary', 'Co-Mentor') NOT NULL DEFAULT 'Primary',
    allocation_status  ENUM('Active', 'Ended') NOT NULL DEFAULT 'Active',
    end_date           DATE         NULL,
    remarks            VARCHAR(500) NULL,
    CONSTRAINT uq_project_mentor UNIQUE (project_id, mentor_id),
    CONSTRAINT fk_alloc_project FOREIGN KEY (project_id)
        REFERENCES capstone_projects (project_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alloc_mentor  FOREIGN KEY (mentor_id)
        REFERENCES capstone_mentors (mentor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alloc_by      FOREIGN KEY (allocated_by)
        REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_alloc_end CHECK (end_date IS NULL OR end_date >= allocation_date)
) ENGINE = InnoDB;

-- Lookup data required by the application (Phase 1 is the default phase)
INSERT IGNORE INTO capstone_phases (phase_id, phase_number, phase_name, description) VALUES
  (1, 1, 'Problem Definition & Planning', 'Topic finalisation, literature survey, synopsis'),
  (2, 2, 'Design',                        'Requirements, architecture, ER diagram, schema design'),
  (3, 3, 'Implementation',                'Development of the core modules'),
  (4, 4, 'Testing & Validation',          'Testing, results and refinement'),
  (5, 5, 'Final Demonstration',           'Final report, demo and viva');
