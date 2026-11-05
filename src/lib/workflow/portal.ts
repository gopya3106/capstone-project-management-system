import { query } from "@/lib/mysql";
import { getMentorContext, getStudentContext, MentorContext, StudentContext } from "./context";
import { listGroupProposals, ProposalRecord } from "./proposals";
import { listProjectSubmissions, SubmissionRecord } from "./submissions";
import { FinalResultRow, listFinalResults, listProjectMarks, StudentMilestoneMark } from "./evaluations";

export interface ProjectProgressRow {
  project_id: number;
  project_title: string;
  project_status: string;
  project_domain: string | null;
  group_id: number;
  group_name: string;
  department: string;
  academic_year: string;
  primary_mentor_name: string | null;
  total_milestones: number;
  milestones_submitted: number;
  milestones_evaluated: number;
  overdue_milestones: number;
  late_submissions: number;
  completion_pct: number | string;
  progress_state: "Completed" | "Closed" | "Pending" | "Delayed" | "Active";
}

export interface MilestoneProgress {
  milestone_id: number;
  milestone_order: number;
  title: string;
  description: string | null;
  due_date: string | Date;
  max_marks: number | string;
  weightage: number | string;
  is_past_due: number;
  latest: SubmissionRecord | null;
  versions: number;
}

export interface GuideRow {
  mentor_id: number;
  full_name: string;
  email: string;
  designation: string | null;
  mentor_role: "Primary" | "Co-Mentor";
}

export async function getProjectProgress(projectId: number): Promise<ProjectProgressRow | null> {
  const [row] = await query<ProjectProgressRow[]>("SELECT * FROM v_project_progress WHERE project_id = ?", [
    projectId,
  ]);
  return row || null;
}

export async function listProjectGuides(projectId: number): Promise<GuideRow[]> {
  return query<GuideRow[]>(
    `SELECT cm.mentor_id, u.full_name, u.email, cm.designation, ma.mentor_role
       FROM mentor_allocations ma
       JOIN capstone_mentors cm ON cm.mentor_id = ma.mentor_id
       JOIN users u ON u.user_id = cm.user_id
      WHERE ma.project_id = ? AND ma.allocation_status = 'Active'
      ORDER BY (ma.mentor_role = 'Primary') DESC, u.full_name`,
    [projectId]
  );
}

export async function getMilestoneProgress(
  academicYear: string,
  projectId: number | null
): Promise<MilestoneProgress[]> {
  const milestones = await query<Omit<MilestoneProgress, "latest" | "versions">[]>(
    `SELECT milestone_id, milestone_order, title, description, due_date, max_marks, weightage,
            (due_date < NOW()) AS is_past_due
       FROM milestones WHERE academic_year = ? ORDER BY milestone_order`,
    [academicYear]
  );
  const subs = projectId ? await listProjectSubmissions(projectId) : [];
  return milestones.map((m) => {
    const mine = subs.filter((s) => s.milestone_id === m.milestone_id);
    return { ...m, latest: mine[0] || null, versions: mine.length };
  });
}

export interface StudentDashboardData {
  ctx: StudentContext;
  progress: ProjectProgressRow | null;
  guides: GuideRow[];
  team: Array<{ usn: string; full_name: string; member_role: string; email: string }>;
  proposals: ProposalRecord[];
  milestones: MilestoneProgress[];
  marks: StudentMilestoneMark[];
  finalResult: FinalResultRow | null;
}

export async function getStudentDashboard(userId: number): Promise<StudentDashboardData> {
  const ctx = await getStudentContext(userId);
  const [progress, guides, team, proposals, milestones, marks, finals] = await Promise.all([
    ctx.project_id ? getProjectProgress(ctx.project_id) : Promise.resolve(null),
    ctx.project_id ? listProjectGuides(ctx.project_id) : Promise.resolve([]),
    ctx.group_id
      ? query<StudentDashboardData["team"]>(
          `SELECT s.usn, u.full_name, gm.member_role, u.email
             FROM group_members gm
             JOIN students s ON s.student_id = gm.student_id
             JOIN users u ON u.user_id = s.user_id
            WHERE gm.group_id = ? AND gm.membership_status = 'Active'
            ORDER BY (gm.member_role = 'Leader') DESC, s.usn`,
          [ctx.group_id]
        )
      : Promise.resolve([]),
    ctx.group_id ? listGroupProposals(ctx.group_id) : Promise.resolve([]),
    ctx.academic_year ? getMilestoneProgress(ctx.academic_year, ctx.project_id) : Promise.resolve([]),
    ctx.project_id ? listProjectMarks(ctx.project_id) : Promise.resolve([]),
    ctx.project_id ? listFinalResults(ctx.project_id) : Promise.resolve([]),
  ]);
  return {
    ctx,
    progress,
    guides,
    team,
    proposals,
    milestones,
    marks: marks.filter((m) => m.student_id === ctx.student_id),
    finalResult: finals.find((f) => f.student_id === ctx.student_id) || null,
  };
}

export interface MentorProjectRow extends ProjectProgressRow {
  mentor_role: "Primary" | "Co-Mentor";
  awaiting_review: number;
}

export interface MentorDashboardData {
  mentor: MentorContext;
  projects: MentorProjectRow[];
  awaitingReview: SubmissionRecord[];
}

export async function getMentorDashboard(userId: number): Promise<MentorDashboardData> {
  const mentor = await getMentorContext(userId);
  const projects = await query<MentorProjectRow[]>(
    `SELECT pp.*, ma.mentor_role,
            (SELECT COUNT(*) FROM submissions s
              WHERE s.project_id = pp.project_id AND s.submission_status IN ('Submitted','Under Review')) AS awaiting_review
       FROM mentor_allocations ma
       JOIN v_project_progress pp ON pp.project_id = ma.project_id
      WHERE ma.mentor_id = ? AND ma.allocation_status = 'Active'
      ORDER BY FIELD(pp.progress_state,'Delayed','Active','Pending','Completed','Closed'), pp.project_title`,
    [mentor.mentor_id]
  );
  const awaitingReview = projects.length
    ? (
        await Promise.all(projects.map((p) => listProjectSubmissions(p.project_id)))
      )
        .flat()
        .filter((s) => s.submission_status === "Submitted" || s.submission_status === "Under Review")
    : [];
  return { mentor, projects, awaitingReview };
}
