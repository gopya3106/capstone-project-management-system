import { query } from "@/lib/mysql";

/**
 * Report queries. Each report reads one of the views in db/003_views.sql,
 * so the SQL that answers "what is delayed / pending / overloaded" lives in
 * the database and can be demonstrated directly in MySQL.
 */

export interface DashboardSummary {
  total_projects: number;
  active_projects: number;
  delayed_projects: number;
  pending_projects: number;
  completed_projects: number;
  proposals_awaiting_review: number;
  overdue_submissions: number;
  submissions_awaiting_review: number;
  projects_without_guide: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [row] = await query<DashboardSummary[]>("SELECT * FROM v_dashboard_summary");
  const out = {} as DashboardSummary;
  for (const [k, v] of Object.entries(row || {})) {
    (out as unknown as Record<string, number>)[k] = Number(v || 0);
  }
  return out;
}

export const REPORTS = {
  "project-progress": {
    title: "Project status & progress",
    view: "v_project_progress",
    order: "FIELD(progress_state,'Delayed','Active','Pending','Completed','Closed'), project_title",
    columns: [
      ["project_title", "Project"],
      ["group_name", "Group"],
      ["project_status", "Status"],
      ["progress_state", "State"],
      ["primary_mentor_name", "Guide"],
      ["milestones_submitted", "Submitted"],
      ["total_milestones", "Milestones"],
      ["completion_pct", "Completion %"],
      ["overdue_milestones", "Overdue"],
      ["late_submissions", "Late"],
    ],
  },
  "milestone-completion": {
    title: "Milestone completion",
    view: "v_milestone_completion",
    order: "academic_year DESC, milestone_order",
    columns: [
      ["academic_year", "Year"],
      ["milestone_order", "#"],
      ["title", "Milestone"],
      ["due_date", "Due"],
      ["eligible_projects", "Projects"],
      ["submitted_projects", "Submitted"],
      ["on_time_projects", "On time"],
      ["late_projects", "Late"],
      ["pending_projects", "Pending"],
      ["evaluated_projects", "Evaluated"],
    ],
  },
  "pending-submissions": {
    title: "Pending submissions",
    view: "v_pending_submissions",
    order: "is_overdue DESC, due_date, project_title",
    columns: [
      ["project_title", "Project"],
      ["group_name", "Group"],
      ["milestone_title", "Milestone"],
      ["due_date", "Due"],
      ["days_overdue", "Days overdue"],
      ["primary_mentor_name", "Guide"],
    ],
  },
  "faculty-workload": {
    title: "Faculty workload",
    view: "v_mentor_workload",
    order: "utilization_pct DESC, full_name",
    columns: [
      ["full_name", "Faculty"],
      ["designation", "Designation"],
      ["department", "Dept"],
      ["availability_status", "Availability"],
      ["primary_count", "Primary"],
      ["co_mentor_count", "Co-mentor"],
      ["active_allocations", "Active"],
      ["max_projects", "Capacity"],
      ["utilization_pct", "Utilisation %"],
    ],
  },
  "evaluation-summary": {
    title: "Evaluation summary",
    view: "v_evaluation_summary",
    order: "project_title, milestone_order",
    columns: [
      ["project_title", "Project"],
      ["group_name", "Group"],
      ["milestone_title", "Milestone"],
      ["evaluator_count", "Evaluators"],
      ["avg_marks", "Avg marks"],
      ["max_marks", "Out of"],
      ["avg_pct", "Avg %"],
      ["min_marks", "Min"],
      ["max_awarded", "Max"],
    ],
  },
  "final-marks": {
    title: "Final project marks",
    view: "v_final_results",
    order: "project_title, usn",
    columns: [
      ["project_title", "Project"],
      ["group_name", "Group"],
      ["usn", "USN"],
      ["student_name", "Student"],
      ["milestones_evaluated", "Milestones evaluated"],
      ["weighted_total", "Total /100"],
      ["grade", "Grade"],
    ],
  },
} as const;

export type ReportKey = keyof typeof REPORTS;

export function isReportKey(value: string): value is ReportKey {
  return Object.prototype.hasOwnProperty.call(REPORTS, value);
}

export async function runReport(key: ReportKey): Promise<Array<Record<string, unknown>>> {
  const def = REPORTS[key];
  // view and order come from the fixed REPORTS map above, never from the request
  return query<Array<Record<string, unknown>>>(`SELECT * FROM ${def.view} ORDER BY ${def.order}`);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString().slice(0, 19).replace("T", " ") : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(key: ReportKey, rows: Array<Record<string, unknown>>): string {
  const cols = REPORTS[key].columns;
  const header = cols.map(([, label]) => csvCell(label)).join(",");
  const body = rows.map((row) => cols.map(([field]) => csvCell(row[field])).join(","));
  return [header, ...body].join("\r\n");
}
