# Capstone Project Management System (CPMS)

A DBMS Level 3 mini-project built with **Next.js (App Router)**, **TypeScript**, **MySQL**, and **MongoDB Atlas**.

---

## 1. System Architecture: MySQL vs. MongoDB Atlas

CPMS uses a **polyglot persistence** architecture to separate authoritative relational business transactions from flexible, append-only history and activity streams.

```
+--------------------------------------------------------------------------+
|                  Capstone Project Management System (CPMS)               |
|                                Next.js App Router                        |
+-------------------------------------+------------------------------------+
                                      |
       +------------------------------+------------------------------+
       |                                                             |
       v                                                             v
+-------------------------------+             +-------------------------------+
|      MySQL (Relational)       |             |     MongoDB Atlas (NoSQL)     |
|   `cpms_db` (Authoritative)   |             |   `cpms_nosql` (Audit & Doc)  |
+-------------------------------+             +-------------------------------+
| • Users, Students & Faculty   |             | • `project_activity`          |
| • Official Projects & Teams   |             |   (Audit trails & events)     |
| • Official Submissions table  |             | • `submission_history`        |
| • Official Evaluation Grades  |             |   (File versions & checksums) |
| • Strict Foreign Keys & ACID  |             | • `mentor_feedback_history`   |
|                               |             |   (Iterative reviews & notes) |
+-------------------------------+             +-------------------------------+
```

### Division of Responsibilities

| Responsibility | Authoritative Store | Database Engine | Rationale |
| :--- | :--- | :--- | :--- |
| **Authentication & Roles** | Authoritative | **MySQL** | Strict uniqueness on email, relational linkage to Students/Mentors, ACID compliance. |
| **User & Role Records** | Authoritative | **MySQL** | Strict foreign keys, unique email/USN constraints, ACID transactional security. |
| **Project & Allocation** | Authoritative | **MySQL** | Enforces relational constraints between students, projects, and faculty mentors. |
| **Official Submissions** | Authoritative | **MySQL** | Authoritative submission timestamps, status, and milestone deadlines. |
| **Official Marks / Rubrics** | Authoritative | **MySQL** | Final evaluations, grade calculations, and transcript records. |
| **Activity Stream & Audit Logs** | Event Log / History | **MongoDB Atlas** | Fast, append-only, flexible metadata payloads that capture polymorphic project events without schema migrations. |
| **Submission Revision History** | Version Archive | **MongoDB Atlas** | Stores multiple file versions, checksums, commit hashes, and changelog diffs per milestone submission. |
| **Mentor Feedback History** | Qualitative Review | **MongoDB Atlas** | Stores iterative comments, qualitative feedback, action checklist items, and review discussions across iterations. |

---

## 2. Authentication & Role-Based Access Control (Phase 1)

CPMS implements secure, server-side authentication and role-based access control (RBAC) backed by the authoritative MySQL `Users` table.

### User Roles
- `Student`: student dashboard (`/dashboard/student`): group and project details, proposal submission, milestone document submission, feedback, marks.
- `Mentor` (Faculty Guide / Evaluator): mentor dashboard (`/dashboard/mentor`): assigned projects, submission review, evaluation marks.
- `Coordinator`: staff console (`/dashboard/admin`): proposal approval, guide allocation, milestones, submission monitoring, reports.
- `Admin`: everything the Coordinator can do, plus student, group and user records.

### Authoritative MySQL `users` Schema
The full schema lives in [`db/001_core_schema.sql`](db/001_core_schema.sql). The `users` table:
```sql
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
    CONSTRAINT uq_users_email UNIQUE (email)
);
```
Only `Active` accounts can sign in.

### Security Architecture
1. **Password Verification**: Passwords are verified against bcrypt hashes using `bcryptjs`. Plaintext passwords are never stored or compared.
2. **Session Tokens**: JWT sessions are cryptographically signed using `jose` with the `HS256` algorithm using `SESSION_SECRET`.
3. **Cookie Security**: Sessions are stored in an `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) cookie (`cpms_session`), preventing JavaScript access (XSS mitigation).
4. **Rate Limiting**: Mitigates brute-force credential attacks by limiting failed attempts per IP (max 5 failed attempts per 15-minute sliding window).
5. **Anti-Enumeration**: Authentication returns generic `Invalid email or password` errors to prevent email/username enumeration.
6. **Server-Side RBAC**: Authorization is enforced strictly on the server (`requireRole()`, `requireStudent()`, `requireMentor()`, `requireAdmin()`). Client-supplied role claims are never trusted.

---

## 3. Environment Variables Configuration

Configure your `.env.local` file in the project root. This file is ignored by Git and must **never** be committed.

```env
# ==========================================
# MySQL Database Configuration
# ==========================================
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=<your_mysql_password>
MYSQL_DATABASE=cpms_db

# ==========================================
# Security & Session Configuration
# ==========================================
# Generate a secure 32+ character string (e.g. openssl rand -base64 32)
SESSION_SECRET=<minimum_32_character_cryptographic_secret>

# ==========================================
# MongoDB Atlas Configuration (OPTIONAL)
# ==========================================
# Leave these out to run on MySQL only; activity / submission-history /
# feedback-history logging is then skipped. Replace placeholders with your Atlas cluster details
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DATABASE=cpms_nosql
```

> **Security Note:** Never commit secret values or `.env.local` to source control.

---

## 4. Getting Started

### Prerequisites
- Node.js 20+
- MySQL Server 8.0.16 or newer (CHECK constraints are enforced from 8.0.16)
- MongoDB Atlas free cluster (optional)

### Installation & Execution

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` (see section 3).

3. Create the database: tables, views, triggers and stored procedures. Add `--seed` for demo data:
   ```bash
   npm run db:setup -- --seed
   ```
   - On an **existing** database, `npm run db:setup` upgrades it in place: it adds the new tables and the `Coordinator` role, and moves the old `Not Started` project status to `Proposed`. Existing rows are kept.
   - `npm run db:reset` drops the database and rebuilds it with demo data (asks for confirmation).
   - The script runs the files in `db/` in order. You can also run them yourself in MySQL Workbench or the `mysql` CLI.

4. Run the development server and open [http://localhost:3000](http://localhost:3000):
   ```bash
   npm run dev
   ```

5. Production build check:
   ```bash
   npm run build
   ```

### Demo accounts (after `--seed`)
All demo accounts use the password **`Cpms@2026`**. They are for local demonstration only.

| Role | Email | What to look at |
| :--- | :--- | :--- |
| Admin | `admin@cpms.demo` | Full console including students and groups |
| Coordinator | `coordinator@cpms.demo` | Proposals awaiting review, delayed project, reports |
| Mentor | `anita.rao@cpms.demo` | Team Alpha: reviewed submissions and marks |
| Mentor | `vikram.shetty@cpms.demo` | Team Quantum: delayed, revision requested |
| Student | `aarav@student.cpms.demo` | Team Alpha leader: on-time and late submissions, marks |
| Student | `priya@student.cpms.demo` | Team Orion: proposal awaiting review |
| Student | `rahul@student.cpms.demo` | Team Helix: rejected v1, v2 under review |
| Student | `varun@student.cpms.demo` | Not in any group |

### Running all tests
With `npm run dev` running in another terminal:
```bash
# PowerShell:  $env:DEMO_ADMIN_PASSWORD="Cpms@2026"; npm run test:all
DEMO_ADMIN_PASSWORD="Cpms@2026" npm run test:all
```
Phase 2 and 3 expect the seeded demo data. Phase 4 creates and removes its own data.

---

## 5. Authentication API Endpoints

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Public (Rate Limited) | Validates credentials via Zod + bcrypt, returns safe user object, sets HttpOnly session cookie. |
| `/api/auth/logout` | `POST` | Authenticated | Clears the `cpms_session` cookie. |
| `/api/auth/me` | `GET` | Authenticated | Returns current authenticated safe user profile (`user_id`, `email`, `role`). |
| `/api/auth/protected-demo` | `GET` | Authenticated | Diagnostic route demonstrating server-side role validation (`?role=Admin`, `Mentor`, `Student`). |

### Example Login Request
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student@pes.edu", "password": "YourPassword123"}' \
  -c cookies.txt
```

### Example Check Current User
```bash
curl http://localhost:3000/api/auth/me -b cookies.txt
```

---

## 6. Testing the MongoDB Health Check

```bash
curl http://localhost:3000/api/mongodb-test
```
Response (HTTP 200):
```json
{
  "success": true,
  "message": "MongoDB Atlas connection successfully established.",
  "database": "cpms_nosql",
  "timestamp": "2026-10-28T16:41:37.754Z"
}
```

---

## 7. MongoDB NoSQL Collections

The application module at `src/lib/nosql` provides type-safe, validated data access for three collections:

1. `project_activity`: Real-time activity audit trail and project event log.
2. `submission_history`: Multi-version milestone submission file snapshots and checksums.
3. `mentor_feedback_history`: Qualitative review commentary, checklist items, and rubric notes.

---

## 8. Student and Group Management (Phase 2)

Phase 2 introduces authoritative student directory management and capstone project group formation.

### Relational Schema Linkage
```
+---------------+       +------------------+       +-------------------+
|     Users     | ----> |     Students     | ----> |   Group_Members   |
|  (Auth Info)  | 1 : 1 |  (USN & Academic)| 1 : N | (Active Membership|
+---------------+       +------------------+       +---------+---------+
                                                             | N : 1
                                                             v
+---------------------+       +------------------------------------+
|  Capstone_Projects  | <---- |           Project_Groups           |
| (Official Project)  | 1 : 1 |    (Team Size, Year, & Leader)     |
+---------------------+       +------------------------------------+
```

### Business Rules & Security Enforcements
1. **Capacity Limit**: Enforces a strict maximum of **4 active members** per capstone group.
2. **Single Active Group Rule**: Prevents any student from belonging to multiple active, non-disbanded groups simultaneously.
3. **Team Leader Integrity**: The designated team leader must be an active member of the created group.
4. **ACID Transactions**: Group creation, member additions, and project linkage are executed atomically within managed MySQL transactions (`withTransaction`), guaranteeing clean rollbacks on failure.
5. **Role-Based Authorization**: All student management, directory queries, and group formation APIs require verified `Admin` role privileges (`requireAdmin()`).
6. **Data Privacy**: Student records, directory views, and group detail queries never expose `password_hash` or sensitive authentication tokens.

### Phase 2 Admin API Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/admin/students` | `GET` | `Admin` | Searchable student directory with filtering by USN, name, department, batch, semester, and allocation status. |
| `/api/admin/students` | `POST` | `Admin` | Provisions a new student and associated user account. |
| `/api/admin/students/[id]` | `GET` | `Admin` | Retrieves detailed student profile, current active group, team roster, and past group history. |
| `/api/admin/students/[id]` | `PATCH` | `Admin` | Updates student academic status, section, semester, or contact details. |
| `/api/admin/students/available` | `GET` | `Admin` | Returns active students who are unassigned to any active capstone group. |
| `/api/admin/groups` | `GET` | `Admin` | Lists capstone groups with leader information, active member count, and linked project status. |
| `/api/admin/groups` | `POST` | `Admin` | Atomically creates a capstone project group, assigns members, and optionally links project synopsis. |
| `/api/admin/groups/[id]` | `GET` | `Admin` | Retrieves full group details, complete member roster, and linked Capstone Project specifications. |

### Running Phase 2 Automated Tests
```bash
npm run test:phase2
```
This automated suite verifies RBAC blocking, student search, credential privacy, 4-member limit enforcement, leader validation, duplicate active group prevention, and multi-table transactional creation.

---

## 9. Capstone Project and Mentor Management (Phase 3)

Phase 3 introduces comprehensive capstone project lifecycle tracking, faculty mentor capacity governance, and role-based mentor allocations.

### Relational Schema Linkage
```
+---------------------+       1 : 1 (Unique)       +------------------------------------+
|  Capstone_Projects  | <------------------------- |           Project_Groups           |
| (Title, Domain, etc)|                            |    (Team Size, Year, & Leader)     |
+----------+----------+                            +------------------------------------+
           | 1 : N
           v
+-----------------------+     N : 1                +------------------------------------+
|   Mentor_Allocations  | -----------------------> |          Capstone_Mentors          |
| (Primary / Co-Mentor) |                          | (Capacity, Workload & Availability)|
+-----------------------+                          +-----------------+------------------+
                                                                     | 1 : 1
                                                                     v
                                                           +-------------------+
                                                           |       Users       |
                                                           |    (Mentor Auth)  |
                                                           +-------------------+
```

### Business Rules & Core Invariants
1. **1-to-1 Group-to-Project Integrity**: Enforces MySQL `UNIQUE KEY` constraint on `Capstone_Projects.group_id`. A capstone group can be associated with at most one capstone project.
2. **Mentor Capacity & Workload Governance**: A faculty mentor's workload is tracked via their active allocations count (`allocation_status = 'Active'`). Allocations are strictly rejected if a mentor has reached their maximum quota (`max_projects`) or if their availability status is set to `Unavailable`.
3. **Primary Mentor Mutual Exclusivity**: A capstone project can have at most one active `Primary` mentor at any given time. When an administrator allocates a new Primary mentor, any existing active Primary mentor allocation is atomically transitioned to `Ended` (`end_date = CURDATE()`) inside a managed transaction.
4. **Duplicate Allocation Prevention**: Enforces the composite unique constraint `uq_project_mentor (project_id, mentor_id)` in `mentor_allocations`. An active mentor cannot be re-allocated to the same project. If an allocation previously ended, the system safely reactivates the record.
5. **ACID Transactional Guarantees**: Multi-step project creation, mentor workload evaluation, and atomic primary mentor reassignments are executed inside `withTransaction()` with row-level locks (`FOR UPDATE`).
6. **Data Confidentiality & RBAC**: All project and mentor management APIs and dashboard views are restricted to administrators (`requireAdmin()`). Sensitive credentials (`password_hash`, session keys) are never exposed.

### Phase 3 Admin API Endpoints

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/admin/projects` | `GET` | `Admin` | Lists capstone projects with search, domain, phase, and status filters, plus aggregate project metrics. |
| `/api/admin/projects` | `POST` | `Admin` | Registers a new capstone project linked to an existing group, validating uniqueness and title rules. |
| `/api/admin/projects/[id]` | `GET` | `Admin` | Retrieves project specifications, student team roster, and full mentor allocation history. |
| `/api/admin/projects/[id]` | `PATCH` | `Admin` | Updates project attributes (status, phase, problem statement, technology stack, repository URL). |
| `/api/admin/projects/available-groups` | `GET` | `Admin` | Lists active groups that do not yet have an assigned project. |
| `/api/admin/mentors` | `GET` | `Admin` | Lists faculty mentors with active workload count, max project capacity, availability, and assigned projects. |
| `/api/admin/mentors/[id]` | `GET` | `Admin` | Retrieves complete mentor profile with past and active project allocation records. |
| `/api/admin/mentors/[id]` | `PATCH` | `Admin` | Updates mentor guidance capacity (`max_projects`), availability status, specialization, or office. |
| `/api/admin/mentors/allocations` | `POST` | `Admin` | Assigns a Primary or Co-Mentor to a project with capacity checks and atomic Primary transition. |
| `/api/admin/mentors/allocations` | `DELETE` | `Admin` | Ends an active mentor allocation, setting `end_date = CURDATE()` and archiving allocation remarks. |

### Running Phase 3 Automated Tests
```bash
npm run test:phase3
```
This automated suite validates:
- Unauthenticated (401) and Non-Admin (403) RBAC enforcement across project and mentor endpoints.
- Project directory queries and aggregate project statistics.
- Full project details, team roster, mentor allocation history, and credential confidentiality.
- 1-to-1 group-to-project unique constraint enforcement (HTTP 409 Conflict).
- Mentor directory workload calculation and department statistics.
- Mentor capacity limits (`max_projects`) and `Unavailable` status blocking.
- Duplicate active assignment rejection and atomic Primary mentor transitions.
- Ending mentor allocations via `DELETE /api/admin/mentors/allocations` and database state verification.

---

## 10. Proposal, Milestone, Submission and Evaluation Workflow (Phase 4)

```
Group formation -> Proposal (student) -> Coordinator review -> Guide allocation
  -> Milestones (coordinator) -> Document submission (student) -> Faculty review
  -> Evaluation marks (faculty) -> Final marks -> Project completion
```

### New tables ([`db/002_workflow_schema.sql`](db/002_workflow_schema.sql))
| Table | Purpose | Key constraints |
| :--- | :--- | :--- |
| `proposals` | Versioned proposals per group | `UNIQUE (group_id, version_no)`, title CHECK, FK to group / student / reviewer |
| `milestones` | Review checkpoints per academic year | `UNIQUE (academic_year, milestone_order)`, CHECK on marks and weightage |
| `submissions` | Versioned documents per project and milestone | `UNIQUE (project_id, milestone_id, version_no)`, URL CHECK, `is_late` flag |
| `evaluations` | One evaluator's review of one milestone | `UNIQUE (project_id, milestone_id, evaluator_id)` |
| `student_evaluations` | Individual marks per student | `UNIQUE (evaluation_id, student_id)`, marks ≥ 0 |
| `final_results` | Output of the final-mark procedure | PK `(project_id, student_id)`, total 0–100 |
| `notifications` | In-app messages | Index `(user_id, is_read, created_at)` |

Marks live only in `student_evaluations`. Group averages, weighted totals and workload are derived in views, so nothing is stored twice (3NF).

### Rules enforced in the database ([`db/004_triggers_procedures.sql`](db/004_triggers_procedures.sql))
| Object | Type | What it does |
| :--- | :--- | :--- |
| `sp_review_proposal` | Procedure (transaction) | Approve / reject / mark under review. Approval creates or updates the project. Rejection needs comments. |
| `sp_allocate_guide` | Procedure (transaction, row locks) | Guide allocation with availability, capacity, duplicate and Primary hand-over rules. Used by the app. |
| `sp_calculate_final_marks` | Procedure (transaction) | Weighted total per student (avg over evaluators ÷ max × weightage). Grade `IP` until every milestone is evaluated. |
| `fn_grade` | Function | Score → O / A+ / A / B+ / B / C / F |
| `trg_proposals_before_insert` | Trigger | Only active members can submit; one pending proposal at a time; none after approval; auto version |
| `trg_proposals_after_insert/update` | Trigger | Notifies coordinators of new proposals and group members of decisions |
| `trg_milestones_before_insert/update` | Trigger | Total weightage per academic year ≤ 100 % |
| `trg_submissions_before_insert` | Trigger | **Late-submission detection**, auto version, submitter must be in the group, project must be approved |
| `trg_submissions_after_insert/update` | Trigger | Moves project to *In Progress*; notifies guides (late or on time) and the group |
| `trg_evaluations_before_insert` | Trigger | Only an allocated guide may evaluate |
| `trg_student_evaluations_before_insert/update` | Trigger | Marks between 0 and the milestone maximum; student must be in the group |
| `trg_allocations_before_insert/update` | Trigger | Capacity guard even for rows written outside the procedure |

### Reports ([`db/003_views.sql`](db/003_views.sql))
`v_project_primary_mentor` (helper), `v_project_progress`, `v_milestone_completion`, `v_pending_submissions`, `v_mentor_workload`, `v_evaluation_summary`, `v_student_milestone_marks`, `v_final_results` and `v_dashboard_summary`. These cover the project-status, milestone-completion, pending-submission, faculty-workload, evaluation-summary and final-marks reports, plus the coordinator dashboard (active / delayed / pending / completed). Each one is shown under **Reports** and can be downloaded as CSV.

### Phase 4 API Endpoints
| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/student/proposals` | `POST` | Student | Submit a proposal for the student's group |
| `/api/student/submissions` | `POST` | Student | Submit a milestone document link (new version each time) |
| `/api/admin/proposals` | `GET` | Coordinator, Admin | List proposals (`?status=Pending`, …) and counts |
| `/api/admin/proposals/[id]` | `PATCH` | Coordinator, Admin | `{ decision, comments }` → `sp_review_proposal` |
| `/api/admin/milestones` | `GET`, `POST` | Coordinator, Admin | List / create milestones |
| `/api/admin/milestones/[id]` | `PATCH`, `DELETE` | Coordinator, Admin | Edit; delete only when unused |
| `/api/admin/submissions` | `GET` | Coordinator, Admin | All submissions (`?status=`, `?late=1`) |
| `/api/admin/reports/[report]` | `GET` | Coordinator, Admin | Report rows; `?format=csv` downloads |
| `/api/admin/projects/[id]/final-marks` | `POST` | Coordinator, Admin | Re-run `sp_calculate_final_marks` |
| `/api/mentor/submissions/[id]` | `PATCH` | Mentor (allocated) | Accept / request revision / under review, with feedback |
| `/api/mentor/evaluations` | `GET`, `PUT` | Mentor (allocated) | Marks sheet; save per-student marks |
| `/api/notifications` | `GET`, `POST` | Any signed-in user | List; mark all read |

Coordinators can also use the project and mentor APIs from Phase 3 (guide allocation). Student and group record management stays Admin-only.

### Running Phase 4 Automated Tests
```bash
npm run test:phase4
```
48 checks: RBAC, the weightage trigger, proposal triggers, proposal review and resubmission versions, guide allocation, late detection and versioning, mentor review authorisation, the marks trigger, final-mark arithmetic and grades, every report plus the CSV export, notifications, and the milestone deletion guard.

### Where each DBMS concept is shown
| Concept | Where |
| :--- | :--- |
| 3NF, PK / FK, UNIQUE, CHECK | `db/001_core_schema.sql`, `db/002_workflow_schema.sql` |
| Joins, aggregates, subqueries, CASE | `db/003_views.sql` (e.g. `v_project_progress`) |
| Views | `db/003_views.sql` (9 views) |
| Indexes | inline `INDEX` in 002 and `cpms_add_index(...)` calls |
| Triggers | `db/004_triggers_procedures.sql` (13 triggers) |
| Stored procedures and a function | `sp_allocate_guide`, `sp_review_proposal`, `sp_calculate_final_marks`, `fn_grade` |
| Transactions | `START TRANSACTION … COMMIT / ROLLBACK` inside each procedure; `withTransaction()` in `src/lib/mysql.ts` |

