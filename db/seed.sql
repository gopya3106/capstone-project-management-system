-- =====================================================================
-- CPMS - seed.sql : demo data for a FRESH database (run after 001-004)
--
-- Every demo account uses the password:  Cpms@2026
-- (local development / demonstration only; change via `npm run provision:admin`)
--
--   admin@cpms.demo         Admin
--   coordinator@cpms.demo   Coordinator
--   anita.rao@cpms.demo     Mentor (mentor_id 1)
--   vikram.shetty@cpms.demo Mentor (mentor_id 2)
--   meera.iyer@cpms.demo    Mentor (mentor_id 3)
--   <name>@student.cpms.demo Students (14)
--
-- The workflow rows (proposals, allocations, submissions, evaluations) are
-- written through the same procedures and triggers the application uses,
-- so the seed itself demonstrates them.
-- =====================================================================

USE cpms_db;

SET @pw = '$2b$12$YH8hPQSun5aaGYOjmpnCquQj4085JkHq4.sw0/e8PTK1DBp5.vrfi';

-- ---------------------------------------------------------------- users
INSERT INTO users (user_id, full_name, email, password_hash, role, phone_number) VALUES
  (1,  'System Administrator', 'admin@cpms.demo',          @pw, 'Admin',       NULL),
  (2,  'Dr. Kavitha Menon',    'coordinator@cpms.demo',    @pw, 'Coordinator', '9845000002'),
  (3,  'Dr. Anita Rao',        'anita.rao@cpms.demo',      @pw, 'Mentor',      '9845000003'),
  (4,  'Prof. Vikram Shetty',  'vikram.shetty@cpms.demo',  @pw, 'Mentor',      '9845000004'),
  (5,  'Dr. Meera Iyer',       'meera.iyer@cpms.demo',     @pw, 'Mentor',      '9845000005'),
  (11, 'Aarav Sharma',   'aarav@student.cpms.demo',   @pw, 'Student', '9900000011'),
  (12, 'Diya Patel',     'diya@student.cpms.demo',    @pw, 'Student', '9900000012'),
  (13, 'Rohan Kulkarni', 'rohan@student.cpms.demo',   @pw, 'Student', '9900000013'),
  (14, 'Sneha Reddy',    'sneha@student.cpms.demo',   @pw, 'Student', '9900000014'),
  (15, 'Karan Mehta',    'karan@student.cpms.demo',   @pw, 'Student', '9900000015'),
  (16, 'Ishita Nair',    'ishita@student.cpms.demo',  @pw, 'Student', '9900000016'),
  (17, 'Aditya Joshi',   'aditya@student.cpms.demo',  @pw, 'Student', '9900000017'),
  (18, 'Priya Hegde',    'priya@student.cpms.demo',   @pw, 'Student', '9900000018'),
  (19, 'Nikhil Bhat',    'nikhil@student.cpms.demo',  @pw, 'Student', '9900000019'),
  (20, 'Ananya Gowda',   'ananya@student.cpms.demo',  @pw, 'Student', '9900000020'),
  (21, 'Rahul Verma',    'rahul@student.cpms.demo',   @pw, 'Student', '9900000021'),
  (22, 'Tanvi Desai',    'tanvi@student.cpms.demo',   @pw, 'Student', '9900000022'),
  (23, 'Varun Pillai',   'varun@student.cpms.demo',   @pw, 'Student', '9900000023'),
  (24, 'Riya Kapoor',    'riya@student.cpms.demo',    @pw, 'Student', '9900000024');

-- ------------------------------------------------------------- students
INSERT INTO students (student_id, user_id, usn, department, specialization, batch, current_semester, section, cgpa) VALUES
  (1,  11, 'DEMO001', 'CSE', 'AI & ML',          '2023-2027', 7, 'A', 9.10),
  (2,  12, 'PES1UG23CS002', 'CSE', 'AI & ML',          '2023-2027', 7, 'A', 8.75),
  (3,  13, 'PES1UG23CS003', 'CSE', 'Systems',          '2023-2027', 7, 'A', 8.20),
  (4,  14, 'PES1UG23CS004', 'CSE', 'Data Science',     '2023-2027', 7, 'A', 8.95),
  (5,  15, 'PES1UG23CS005', 'CSE', 'Cyber Security',   '2023-2027', 7, 'B', 7.80),
  (6,  16, 'PES1UG23CS006', 'CSE', 'Data Science',     '2023-2027', 7, 'B', 8.40),
  (7,  17, 'PES1UG23CS007', 'CSE', 'Systems',          '2023-2027', 7, 'B', 7.95),
  (8,  18, 'PES1UG23CS008', 'CSE', 'AI & ML',          '2023-2027', 7, 'C', 9.30),
  (9,  19, 'PES1UG23CS009', 'CSE', 'Cloud Computing',  '2023-2027', 7, 'C', 8.05),
  (10, 20, 'PES1UG23CS010', 'CSE', 'Cloud Computing',  '2023-2027', 7, 'C', 8.60),
  (11, 21, 'PES1UG23CS011', 'CSE', 'IoT',              '2023-2027', 7, 'D', 7.65),
  (12, 22, 'PES1UG23CS012', 'CSE', 'IoT',              '2023-2027', 7, 'D', 8.15),
  (13, 23, 'PES1UG23CS013', 'CSE', 'Systems',          '2023-2027', 7, 'D', 7.40),
  (14, 24, 'PES1UG23CS014', 'CSE', 'AI & ML',          '2023-2027', 7, 'D', 8.85);

-- -------------------------------------------------------------- mentors
INSERT INTO capstone_mentors (mentor_id, user_id, employee_id, department, designation, specialization,
                              years_of_experience, max_projects, availability_status, office_location) VALUES
  (1, 3, 'FAC-CSE-101', 'CSE', 'Associate Professor', 'Machine Learning, IoT',          12, 4, 'Available', 'Block B, 204'),
  (2, 4, 'FAC-CSE-102', 'CSE', 'Assistant Professor', 'Distributed Systems, Cloud',      7, 3, 'Available', 'Block B, 210'),
  (3, 5, 'FAC-CSE-103', 'CSE', 'Professor',           'Databases, Data Engineering',    18, 5, 'Available', 'Block A, 101');

-- --------------------------------------------------------------- groups
INSERT INTO project_groups (group_id, group_name, batch, department, academic_year, formation_date,
                            team_leader_id, team_size, group_status) VALUES
  (1, 'Team Alpha',   '2023-2027', 'CSE', '2026-2027', '2026-08-01', 1,  4, 'Active'),
  (2, 'Team Quantum', '2023-2027', 'CSE', '2026-2027', '2026-08-02', 5,  3, 'Active'),
  (3, 'Team Orion',   '2023-2027', 'CSE', '2026-2027', '2026-08-03', 8,  3, 'Active'),
  (4, 'Team Helix',   '2023-2027', 'CSE', '2026-2027', '2026-08-05', 11, 2, 'Active');

INSERT INTO group_members (group_id, student_id, member_role, joined_at) VALUES
  (1, 1, 'Leader', '2026-08-01 10:00:00'), (1, 2, 'Member', '2026-08-01 10:00:00'),
  (1, 3, 'Member', '2026-08-01 10:00:00'), (1, 4, 'Member', '2026-08-01 10:00:00'),
  (2, 5, 'Leader', '2026-08-02 10:00:00'), (2, 6, 'Member', '2026-08-02 10:00:00'),
  (2, 7, 'Member', '2026-08-02 10:00:00'),
  (3, 8, 'Leader', '2026-08-03 10:00:00'), (3, 9, 'Member', '2026-08-03 10:00:00'),
  (3, 10,'Member', '2026-08-03 10:00:00'),
  (4, 11,'Leader', '2026-08-05 10:00:00'), (4, 12,'Member', '2026-08-05 10:00:00');
-- students 13 and 14 are intentionally left without a group

-- ----------------------------------------------------------- milestones
INSERT INTO milestones (milestone_id, academic_year, milestone_order, title, description, due_date,
                        max_marks, weightage, created_by) VALUES
  (1, '2026-2027', 1, 'Synopsis & Literature Review', 'Problem statement, objectives, literature survey.', '2026-09-15 23:59:59', 25,  15, 2),
  (2, '2026-2027', 2, 'Design Review',                'Requirements, architecture, ER diagram, schema.',  '2026-10-20 23:59:59', 50,  25, 2),
  (3, '2026-2027', 3, 'Mid-term Implementation',      'Working core modules and progress report.',       '2026-12-01 23:59:59', 50,  30, 2),
  (4, '2026-2027', 4, 'Final Demonstration & Report', 'Final demo, report and viva.',                     '2027-01-20 23:59:59', 100, 30, 2);

-- ------------------------------------------------- proposals + review
-- Team Alpha: approved -> project 1
INSERT INTO proposals (group_id, submitted_by, title, abstract, objectives, methodology, technology_stack, project_domain, submitted_at)
VALUES (1, 1, 'Smart Campus Energy Monitoring System',
        'An IoT and analytics platform that tracks electricity usage across campus buildings and flags waste in real time.',
        'Real-time metering; anomaly detection; department-wise dashboards.',
        'Sensor nodes -> MQTT -> time-series store -> ML anomaly model -> web dashboard.',
        'ESP32, MQTT, Python, MySQL, Next.js', 'IoT', '2026-08-10 11:00:00');
CALL sp_review_proposal(LAST_INSERT_ID(), 2, 'Approved', 'Well scoped. Proceed.');

-- Team Quantum: approved -> project 2
INSERT INTO proposals (group_id, submitted_by, title, abstract, objectives, methodology, technology_stack, project_domain, submitted_at)
VALUES (2, 5, 'Federated Learning for Hospital Readmission Prediction',
        'Predict 30-day readmission risk across hospitals without sharing raw patient data.',
        'Privacy-preserving training; model comparison; clinician dashboard.',
        'Flower framework with FedAvg over three simulated hospital nodes.',
        'Python, PyTorch, Flower, FastAPI', 'AI & ML', '2026-08-11 15:30:00');
CALL sp_review_proposal(LAST_INSERT_ID(), 2, 'Approved', 'Good problem; watch the dataset licensing.');

-- Team Orion: waiting for review
INSERT INTO proposals (group_id, submitted_by, title, abstract, objectives, technology_stack, project_domain, submitted_at)
VALUES (3, 8, 'Serverless Log Analytics Pipeline',
        'A cost-efficient pipeline that ingests, indexes and queries application logs using serverless components.',
        'Ingestion at 10k events/s; sub-second search; cost report.',
        'AWS Lambda, Kinesis, OpenSearch', 'Cloud Computing', '2026-10-28 09:15:00');

-- Team Helix: v1 rejected, v2 under review
INSERT INTO proposals (group_id, submitted_by, title, abstract, technology_stack, project_domain, submitted_at)
VALUES (4, 11, 'Smart Parking App',
        'A mobile app showing free parking slots.', 'Flutter, Firebase', 'IoT', '2026-08-20 10:00:00');
CALL sp_review_proposal(LAST_INSERT_ID(), 2, 'Rejected', 'Scope too small for a capstone; add sensing and prediction.');

INSERT INTO proposals (group_id, submitted_by, title, abstract, objectives, methodology, technology_stack, project_domain, submitted_at)
VALUES (4, 11, 'Predictive Smart Parking with Edge Sensing',
        'Ultrasonic edge sensors detect slot occupancy; a forecasting model predicts availability 30 minutes ahead.',
        'Occupancy sensing; availability forecast; navigation app.',
        'ESP32 sensors, LSTM forecaster, Flutter client.',
        'ESP32, Python, TensorFlow, Flutter', 'IoT', '2026-09-02 14:00:00');
CALL sp_review_proposal(LAST_INSERT_ID(), 2, 'Under Review', NULL);

-- ------------------------------------------------- guide allocation
CALL sp_allocate_guide(1, 1, 'Primary',   2, 'Domain match: IoT + ML', @a);
CALL sp_allocate_guide(1, 3, 'Co-Mentor', 2, 'Data engineering support', @a);
CALL sp_allocate_guide(2, 2, 'Primary',   2, 'Distributed training expertise', @a);

-- ------------------------------------------------------- submissions
-- Team Alpha: M1 on time, M2 late (trigger sets is_late and version_no)
INSERT INTO submissions (project_id, milestone_id, submitted_by, document_title, document_url, notes, submitted_at)
VALUES (1, 1, 1, 'Synopsis v1', 'https://drive.example.com/alpha/synopsis-v1.pdf', 'Initial synopsis', '2026-09-14 18:20:00');
INSERT INTO submissions (project_id, milestone_id, submitted_by, document_title, document_url, notes, submitted_at)
VALUES (1, 2, 2, 'Design document', 'https://drive.example.com/alpha/design.pdf', 'ER diagram and architecture', '2026-10-23 21:05:00');

-- Team Quantum: M1 one day late, M2 missing (shows as overdue / delayed)
INSERT INTO submissions (project_id, milestone_id, submitted_by, document_title, document_url, submitted_at)
VALUES (2, 1, 5, 'Synopsis', 'https://drive.example.com/quantum/synopsis.pdf', '2026-09-16 10:40:00');

UPDATE submissions SET submission_status = 'Accepted', reviewed_by = 1, reviewed_at = '2026-09-17 12:00:00',
       feedback = 'Clear objectives. Expand the literature survey slightly.'
 WHERE project_id = 1 AND milestone_id = 1;
UPDATE submissions SET submission_status = 'Accepted', reviewed_by = 1, reviewed_at = '2026-10-25 12:00:00',
       feedback = 'Solid schema. Submitted late; please plan ahead for the mid-term.'
 WHERE project_id = 1 AND milestone_id = 2;
UPDATE submissions SET submission_status = 'Revision Requested', reviewed_by = 2, reviewed_at = '2026-09-18 16:00:00',
       feedback = 'Clarify how patient data stays local at each node.'
 WHERE project_id = 2 AND milestone_id = 1;

-- ------------------------------------------------------- evaluations
INSERT INTO evaluations (evaluation_id, project_id, milestone_id, evaluator_id, comments) VALUES
  (1, 1, 1, 1, 'Strong problem framing.'),
  (2, 1, 1, 3, 'Good survey; data pipeline needs more detail.'),
  (3, 1, 2, 1, 'Normalised schema, clear architecture.'),
  (4, 2, 1, 2, 'Reasonable start.');

INSERT INTO student_evaluations (evaluation_id, student_id, marks_awarded, remarks) VALUES
  (1, 1, 22, 'Led the presentation'), (1, 2, 21, NULL), (1, 3, 19, NULL), (1, 4, 20, NULL),
  (2, 1, 21, NULL), (2, 2, 22, NULL), (2, 3, 18, NULL), (2, 4, 21, NULL),
  (3, 1, 44, NULL), (3, 2, 42, NULL), (3, 3, 38, 'Contribute more to the design'), (3, 4, 45, NULL),
  (4, 5, 18, NULL), (4, 6, 19, NULL), (4, 7, 16, NULL);

-- running totals so far (final marks get recalculated as evaluations arrive)
CALL sp_calculate_final_marks(1);
CALL sp_calculate_final_marks(2);
