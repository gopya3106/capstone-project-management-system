import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getDashboardSummary, isReportKey, REPORTS, ReportKey, runReport } from "@/lib/workflow";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  PageShell,
  Section,
  Stat,
  EmptyState,
  Table,
  Td,
  StatusBadge,
  Badge,
  ProgressBar,
  formatDate,
  num,
  secondaryButtonClass,
} from "@/components/ui";
import { RecalculateButton } from "@/components/workflow/StaffForms";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ report?: string }> };

const STATUS_FIELDS = new Set(["project_status", "progress_state", "availability_status"]);
const DATE_FIELDS = new Set(["due_date"]);
const PCT_FIELDS = new Set(["completion_pct", "utilization_pct", "avg_pct"]);

function renderCell(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return <span className="text-zinc-400">—</span>;
  if (STATUS_FIELDS.has(field)) return <StatusBadge status={String(value)} />;
  if (DATE_FIELDS.has(field)) return formatDate(value as Date, true);
  if (PCT_FIELDS.has(field)) {
    return (
      <div className="min-w-24">
        <div className="mb-0.5 text-[11px]">{num(value, 1)}%</div>
        <ProgressBar value={Number(value)} />
      </div>
    );
  }
  if (field === "grade") {
    return String(value) === "IP" ? <Badge tone="amber">In progress</Badge> : <Badge tone="purple">{String(value)}</Badge>;
  }
  if (field === "days_overdue") {
    const n = Number(value);
    return n > 0 ? <strong className="text-rose-600">{n} late</strong> : <span className="text-zinc-500">{-n} left</span>;
  }
  if (typeof value === "number" || /^-?\d+(\.\d+)?$/.test(String(value))) return num(value, 2);
  return String(value);
}

export default async function ReportsPage({ searchParams }: Props) {
  let session;
  try {
    session = await requireStaff();
  } catch {
    redirect("/login");
  }

  const requested = (await searchParams).report || "project-progress";
  const key: ReportKey = isReportKey(requested) ? requested : "project-progress";
  const [summary, rows] = await Promise.all([getDashboardSummary(), runReport(key)]);
  const def = REPORTS[key];
  const finalProjects =
    key === "final-marks"
      ? Array.from(new Map(rows.map((r) => [Number(r.project_id), String(r.project_title)])).entries())
      : [];

  return (
    <PageShell
      badge={session.role === "Coordinator" ? "Coordinator Console" : "Departmental Coordinator"}
      badgeTone="purple"
      title="Reports"
      subtitle="Each report reads a database view (db/003_views.sql) and can be downloaded as CSV for Excel."
      nav={<AdminNav role={session.role} />}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Active" value={summary.active_projects} tone="blue" hint="On track" />
        <Stat label="Delayed" value={summary.delayed_projects} tone="red" hint="Overdue milestones" />
        <Stat label="Pending" value={summary.pending_projects} tone="amber" hint="Proposal stage" />
        <Stat label="Completed" value={summary.completed_projects} tone="green" hint="Finished" />
        <Stat label="Overdue items" value={summary.overdue_submissions} tone="red" hint="Missing submissions" />
      </div>

      <div className="flex flex-wrap gap-1">
        {(Object.keys(REPORTS) as ReportKey[]).map((k) => (
          <Link
            key={k}
            href={`/dashboard/admin/reports?report=${k}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              k === key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {REPORTS[k].title}
          </Link>
        ))}
      </div>

      <Section
        title={def.title}
        description={
          <>
            Source: <code className="font-mono">{def.view}</code> · {rows.length} row{rows.length === 1 ? "" : "s"}
          </>
        }
        actions={
          <a href={`/api/admin/reports/${key}?format=csv`} className={secondaryButtonClass}>
            Download CSV
          </a>
        }
      >
        {rows.length === 0 ? (
          <EmptyState>No data for this report yet.</EmptyState>
        ) : (
          <Table head={def.columns.map(([, label]) => label)}>
            {rows.map((row, i) => (
              <tr key={i}>
                {def.columns.map(([field]) => (
                  <Td key={field} className={field.endsWith("title") || field.endsWith("name") ? "font-medium" : ""}>
                    {renderCell(field, row[field])}
                  </Td>
                ))}
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {key === "final-marks" && finalProjects.length > 0 && (
        <Section
          title="Recalculate final marks"
          description="Runs the stored procedure sp_calculate_final_marks for one project. It also runs automatically whenever a guide saves marks."
        >
          <div className="flex flex-wrap gap-4">
            {finalProjects.map(([id, title]) => (
              <div key={id} className="flex items-center gap-2 text-xs">
                <span className="font-medium">{title}</span>
                <RecalculateButton projectId={id} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </PageShell>
  );
}
