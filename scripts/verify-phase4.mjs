/**
 * CPMS Phase 4 verification: full capstone workflow.
 *
 * Proposal -> coordinator review (sp_review_proposal) -> guide allocation
 * (sp_allocate_guide) -> milestones (weightage trigger) -> submissions
 * (version + late-detection triggers) -> mentor review -> evaluation
 * (marks triggers) -> final marks (sp_calculate_final_marks) -> reports
 * (views) -> notifications (triggers) -> RBAC.
 *
 * Creates its own temporary users / group / milestones in a dedicated
 * academic year and removes them afterwards, so it can run on any database.
 *
 *   npm run dev            (in one terminal)
 *   npm run test:phase4    (in another)
 */

import nextEnv from "@next/env";
import { SignJWT } from "jose";

const loadEnv = nextEnv.loadEnvConfig || nextEnv.default?.loadEnvConfig;
if (loadEnv) loadEnv(process.cwd());

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const YEAR = "2098-2099";
const TAG = "p4test";

const { query, pool } = await import("../src/lib/mysql.ts");

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : "");
  }
}

async function token(userId, email, role) {
  const key = new TextEncoder().encode(process.env.SESSION_SECRET.trim());
  return new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
}

function client(tok) {
  return async (method, path, body) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: `cpms_session=${tok}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : await res.text();
    return { status: res.status, data, type };
  };
}

const ids = { users: [], students: [], mentors: [], group: null, project: null, milestones: [] };

async function insertUser(name, role) {
  const r = await query(
    "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, 'not-a-login-hash', ?)",
    [name, `${TAG}.${name.toLowerCase().replace(/\s+/g, ".")}@cpms.demo`, role]
  );
  ids.users.push(r.insertId);
  return r.insertId;
}

async function setup() {
  const coordUser = await insertUser("P4 Coordinator", "Coordinator");
  const leadUser = await insertUser("P4 Leader", "Student");
  const memberUser = await insertUser("P4 Member", "Student");
  const outsiderUser = await insertUser("P4 Outsider", "Student");
  const guideUser = await insertUser("P4 Guide", "Mentor");
  const otherGuideUser = await insertUser("P4 Other Guide", "Mentor");

  const stu = async (userId, usn) => {
    const r = await query(
      "INSERT INTO students (user_id, usn, department, batch, current_semester) VALUES (?, ?, 'CSE', '2095-2099', 7)",
      [userId, usn]
    );
    ids.students.push(r.insertId);
    return r.insertId;
  };
  const lead = await stu(leadUser, "P4TEST001");
  const member = await stu(memberUser, "P4TEST002");
  await stu(outsiderUser, "P4TEST003");

  const men = async (userId, emp) => {
    const r = await query(
      "INSERT INTO capstone_mentors (user_id, employee_id, department, max_projects) VALUES (?, ?, 'CSE', 3)",
      [userId, emp]
    );
    ids.mentors.push(r.insertId);
    return r.insertId;
  };
  const guide = await men(guideUser, "P4-FAC-1");
  await men(otherGuideUser, "P4-FAC-2");

  const g = await query(
    `INSERT INTO project_groups (group_name, batch, department, academic_year, formation_date, team_leader_id, team_size, group_status)
     VALUES ('P4 Test Group', '2095-2099', 'CSE', ?, CURDATE(), ?, 2, 'Active')`,
    [YEAR, lead]
  );
  ids.group = g.insertId;
  await query("INSERT INTO group_members (group_id, student_id, member_role) VALUES (?, ?, 'Leader'), (?, ?, 'Member')", [
    ids.group,
    lead,
    ids.group,
    member,
  ]);

  return {
    coordinator: client(await token(coordUser, "p4.coord@cpms.demo", "Coordinator")),
    leader: client(await token(leadUser, "p4.lead@cpms.demo", "Student")),
    outsider: client(await token(outsiderUser, "p4.out@cpms.demo", "Student")),
    guide: client(await token(guideUser, "p4.guide@cpms.demo", "Mentor")),
    otherGuide: client(await token(otherGuideUser, "p4.other@cpms.demo", "Mentor")),
    guideId: guide,
    leadId: lead,
    memberId: member,
  };
}

async function cleanup() {
  // projects cascade to submissions, evaluations, allocations, final results
  if (ids.group) {
    await query("DELETE FROM capstone_projects WHERE group_id = ?", [ids.group]);
    await query("DELETE FROM proposals WHERE group_id = ?", [ids.group]);
  }
  await query("DELETE FROM milestones WHERE academic_year = ?", [YEAR]);
  if (ids.group) {
    await query("DELETE FROM group_members WHERE group_id = ?", [ids.group]);
    await query("DELETE FROM project_groups WHERE group_id = ?", [ids.group]);
  }
  for (const id of ids.mentors) await query("DELETE FROM capstone_mentors WHERE mentor_id = ?", [id]);
  for (const id of ids.students) await query("DELETE FROM students WHERE student_id = ?", [id]);
  for (const id of ids.users) await query("DELETE FROM users WHERE user_id = ?", [id]);
  await query("DELETE FROM notifications WHERE message LIKE '%P4 Test%' OR message LIKE '%P4 Workflow%'");
}

async function main() {
  console.log("\n======================================================");
  console.log("CPMS Phase 4: Proposal → Evaluation Workflow Verification");
  console.log(`Target: ${BASE_URL}`);
  console.log("======================================================");

  const u = await setup();

  try {
    console.log("\n[1] RBAC");
    check("Student blocked from coordinator API (403)", (await u.leader("GET", "/api/admin/proposals")).status === 403);
    check("Mentor blocked from proposal review (403)", (await u.guide("PATCH", "/api/admin/proposals/1", { decision: "Approved" })).status === 403);
    check("Coordinator blocked from student-records API (403)", (await u.coordinator("GET", "/api/admin/students")).status === 403);
    check("Unauthenticated blocked (401)", (await fetch(`${BASE_URL}/api/notifications`)).status === 401);

    console.log("\n[2] Milestones (weightage trigger, CHECK constraints)");
    const ms = [
      { milestone_order: 1, title: "P4 Synopsis", due_date: "2020-01-01", max_marks: 20, weightage: 40 },
      { milestone_order: 2, title: "P4 Final", due_date: "2099-12-31", max_marks: 50, weightage: 60 },
    ];
    for (const m of ms) {
      const r = await u.coordinator("POST", "/api/admin/milestones", { academic_year: YEAR, ...m });
      check(`Created milestone "${m.title}" (201)`, r.status === 201, r.data);
      ids.milestones.push(r.data.milestone_id);
    }
    const over = await u.coordinator("POST", "/api/admin/milestones", {
      academic_year: YEAR, milestone_order: 3, title: "P4 Extra", due_date: "2099-01-01", max_marks: 10, weightage: 5,
    });
    check("Weightage above 100% rejected by trigger (400)", over.status === 400 && /exceed 100%/.test(over.data.message), over.data);
    const dup = await u.coordinator("POST", "/api/admin/milestones", {
      academic_year: YEAR, milestone_order: 1, title: "P4 Dup", due_date: "2099-01-01", max_marks: 10, weightage: 0.5,
    });
    check("Duplicate milestone order rejected (UNIQUE -> 409 or trigger 400)", dup.status === 409 || dup.status === 400, dup.data);

    console.log("\n[3] Proposal submission (trigger rules)");
    const proposal = {
      title: "P4 Workflow Test Project",
      abstract: "An automated test proposal that exercises every stage of the CPMS workflow end to end.",
      technology_stack: "Node.js, MySQL",
      project_domain: "Testing",
    };
    const outsiderTry = await u.outsider("POST", "/api/student/proposals", proposal);
    check("Student without a group cannot submit (400)", outsiderTry.status === 400, outsiderTry.data);
    const p1 = await u.leader("POST", "/api/student/proposals", proposal);
    check("Leader submitted proposal (201)", p1.status === 201, p1.data);
    const p1dup = await u.leader("POST", "/api/student/proposals", proposal);
    check("Second pending proposal blocked by trigger (400)", p1dup.status === 400 && /awaiting review/.test(p1dup.data.message), p1dup.data);

    console.log("\n[4] Coordinator review (sp_review_proposal)");
    const noComment = await u.coordinator("PATCH", `/api/admin/proposals/${p1.data.proposal_id}`, { decision: "Rejected" });
    check("Rejecting without comments refused (400)", noComment.status === 400, noComment.data);
    const rej = await u.coordinator("PATCH", `/api/admin/proposals/${p1.data.proposal_id}`, { decision: "Rejected", comments: "Needs a sharper scope." });
    check("Proposal v1 rejected (200)", rej.status === 200, rej.data);
    const p2 = await u.leader("POST", "/api/student/proposals", { ...proposal, title: "P4 Workflow Test Project v2" });
    check("Resubmission allowed after rejection (201)", p2.status === 201, p2.data);
    const [{ version_no }] = await query("SELECT version_no FROM proposals WHERE proposal_id = ?", [p2.data.proposal_id]);
    check("Trigger assigned version 2", Number(version_no) === 2, version_no);
    const appr = await u.coordinator("PATCH", `/api/admin/proposals/${p2.data.proposal_id}`, { decision: "Approved", comments: "Approved." });
    check("Proposal v2 approved and project created", appr.status === 200 && appr.data.project_id > 0, appr.data);
    ids.project = appr.data.project_id;
    const [proj] = await query("SELECT project_title, project_status FROM capstone_projects WHERE project_id = ?", [ids.project]);
    check("Project status is Approved with proposal title", proj?.project_status === "Approved" && proj?.project_title === "P4 Workflow Test Project v2", proj);
    const again = await u.coordinator("PATCH", `/api/admin/proposals/${p2.data.proposal_id}`, { decision: "Rejected", comments: "x" });
    check("Already-reviewed proposal cannot be re-decided (400)", again.status === 400, again.data);

    console.log("\n[5] Guide allocation (sp_allocate_guide via existing API)");
    const alloc = await u.coordinator("POST", "/api/admin/mentors/allocations", { project_id: ids.project, mentor_id: u.guideId, mentor_role: "Primary" });
    check("Coordinator allocated a Primary guide (201)", alloc.status === 201, alloc.data);

    console.log("\n[6] Submissions (version + late triggers)");
    const badUrl = await u.leader("POST", "/api/student/submissions", { milestone_id: ids.milestones[0], document_title: "Doc", document_url: "not a url" });
    check("Invalid document link rejected (400)", badUrl.status === 400, badUrl.data);
    const s1 = await u.leader("POST", "/api/student/submissions", { milestone_id: ids.milestones[0], document_title: "P4 Synopsis", document_url: "https://example.com/p4/synopsis.pdf" });
    check("Submission after due date accepted and flagged late", s1.status === 201 && s1.data.submission.is_late === 1 && s1.data.submission.version_no === 1, s1.data);
    const s2 = await u.leader("POST", "/api/student/submissions", { milestone_id: ids.milestones[0], document_title: "P4 Synopsis rev", document_url: "https://example.com/p4/synopsis-2.pdf" });
    check("Resubmission becomes version 2", s2.status === 201 && s2.data.submission.version_no === 2, s2.data);
    const s3 = await u.leader("POST", "/api/student/submissions", { milestone_id: ids.milestones[1], document_title: "P4 Final", document_url: "https://example.com/p4/final.pdf" });
    check("On-time submission not flagged late", s3.status === 201 && s3.data.submission.is_late === 0, s3.data);
    const [pstat] = await query("SELECT project_status FROM capstone_projects WHERE project_id = ?", [ids.project]);
    check("First submission moved project to In Progress (trigger)", pstat.project_status === "In Progress", pstat);

    console.log("\n[7] Mentor review");
    const foreign = await u.otherGuide("PATCH", `/api/mentor/submissions/${s2.data.submission.submission_id}`, { submission_status: "Accepted" });
    check("Unallocated mentor cannot review (403)", foreign.status === 403, foreign.data);
    const noFb = await u.guide("PATCH", `/api/mentor/submissions/${s2.data.submission.submission_id}`, { submission_status: "Revision Requested" });
    check("Revision request needs feedback (400)", noFb.status === 400, noFb.data);
    const rev = await u.guide("PATCH", `/api/mentor/submissions/${s2.data.submission.submission_id}`, { submission_status: "Accepted", feedback: "Good work." });
    check("Guide accepted the submission (200)", rev.status === 200, rev.data);

    console.log("\n[8] Evaluation (marks triggers) and final marks (sp_calculate_final_marks)");
    const sheet = await u.guide("GET", `/api/mentor/evaluations?project_id=${ids.project}&milestone_id=${ids.milestones[0]}`);
    check("Evaluation sheet lists both members", sheet.status === 200 && sheet.data.sheet.students.length === 2, sheet.data);
    const tooHigh = await u.guide("PUT", "/api/mentor/evaluations", {
      project_id: ids.project, milestone_id: ids.milestones[0], marks: [{ student_id: u.leadId, marks_awarded: 25 }],
    });
    check("Marks above max rejected by trigger (400)", tooHigh.status === 400 && /between 0 and 20/.test(tooHigh.data.message), tooHigh.data);
    const ev1 = await u.guide("PUT", "/api/mentor/evaluations", {
      project_id: ids.project, milestone_id: ids.milestones[0], comments: "Solid start.",
      marks: [{ student_id: u.leadId, marks_awarded: 18 }, { student_id: u.memberId, marks_awarded: 15 }],
    });
    check("Milestone 1 evaluation saved (200)", ev1.status === 200, ev1.data);
    let [fr] = await query("SELECT weighted_total, grade FROM final_results WHERE project_id = ? AND student_id = ?", [ids.project, u.leadId]);
    check("Partial result: 18/20 × 40% = 36.00, grade IP", Number(fr?.weighted_total) === 36 && fr?.grade === "IP", fr);
    const ev2 = await u.guide("PUT", "/api/mentor/evaluations", {
      project_id: ids.project, milestone_id: ids.milestones[1],
      marks: [{ student_id: u.leadId, marks_awarded: 45 }, { student_id: u.memberId, marks_awarded: 30 }],
    });
    check("Milestone 2 evaluation saved (200)", ev2.status === 200, ev2.data);
    [fr] = await query("SELECT weighted_total, grade FROM final_results WHERE project_id = ? AND student_id = ?", [ids.project, u.leadId]);
    check("Final: 36 + 45/50 × 60% = 90.00, grade O", Number(fr?.weighted_total) === 90 && fr?.grade === "O", fr);
    const edit = await u.guide("PUT", "/api/mentor/evaluations", {
      project_id: ids.project, milestone_id: ids.milestones[1],
      marks: [{ student_id: u.leadId, marks_awarded: 40 }],
    });
    [fr] = await query("SELECT weighted_total, grade FROM final_results WHERE project_id = ? AND student_id = ?", [ids.project, u.leadId]);
    check("Editing marks updates the same evaluation and final (84.00, A+)", edit.status === 200 && Number(fr?.weighted_total) === 84 && fr?.grade === "A+", fr);
    const recalc = await u.coordinator("POST", `/api/admin/projects/${ids.project}/final-marks`);
    check("Coordinator can trigger recalculation (200)", recalc.status === 200 && recalc.data.results.length === 2, recalc.data);

    console.log("\n[9] Reports (views) and CSV export");
    for (const key of ["project-progress", "milestone-completion", "pending-submissions", "faculty-workload", "evaluation-summary", "final-marks"]) {
      const r = await u.coordinator("GET", `/api/admin/reports/${key}`);
      check(`Report ${key} (200)`, r.status === 200 && Array.isArray(r.data.rows), r.data);
    }
    const prog = await u.coordinator("GET", "/api/admin/reports/project-progress");
    const row = prog.data.rows.find((x) => x.project_id === ids.project);
    check("Progress view shows 2/2 milestones, 1 late, 100%", row && Number(row.milestones_submitted) === 2 && Number(row.late_submissions) === 1 && Number(row.completion_pct) === 100, row);
    const csv = await u.coordinator("GET", "/api/admin/reports/final-marks?format=csv");
    check("CSV export returns text/csv with header", csv.type.includes("text/csv") && csv.data.startsWith("Project,Group,USN"), csv.type);
    check("Unknown report returns 404", (await u.coordinator("GET", "/api/admin/reports/nope")).status === 404);

    console.log("\n[10] Notifications (triggers)");
    const notes = await u.leader("GET", "/api/notifications");
    const titles = notes.data.notifications.map((n) => n.title);
    check("Student notified of rejection, approval and review", ["Proposal rejected", "Proposal approved", "Submission accepted"].every((t) => titles.includes(t)), titles);
    const gnotes = await u.guide("GET", "/api/notifications");
    check("Guide notified of the late submission", gnotes.data.notifications.some((n) => n.title === "Late submission received"), gnotes.data);
    await u.leader("POST", "/api/notifications");
    check("Mark-all-read clears unread count", (await u.leader("GET", "/api/notifications")).data.unread === 0);

    console.log("\n[11] Milestone deletion guard");
    const del = await u.coordinator("DELETE", `/api/admin/milestones/${ids.milestones[0]}`);
    check("Milestone with submissions cannot be deleted (409)", del.status === 409, del.data);
  } finally {
    await cleanup();
    console.log("\n  • Temporary test data removed.");
    await pool.end();
  }

  console.log("\n======================================================");
  console.log(`Phase 4 Verification Summary: ${passed}/${passed + failed} checks passed.`);
  console.log("======================================================\n");
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  try {
    await cleanup();
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
