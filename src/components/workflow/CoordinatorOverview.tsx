import Link from "next/link";
import { getDashboardSummary, runReport } from "@/lib/workflow";
import { Section, Stat, StatusBadge, Table, Td, EmptyState, ProgressBar, num } from "@/components/ui";

/** Coordinator dashboard: v_dashboard_summary + the items that need action. */
export async function CoordinatorOverview() {
  const [summary, progress] = await Promise.all([getDashboardSummary(), runReport("project-progress")]);
  const attention = progress.filter((p) => p.progress_state === "Delayed" || p.progress_state === "Pending");

  const actions = [
    { n: summary.proposals_awaiting_review, label: "proposals awaiting your decision", href: "/dashboard/admin/proposals" },
    { n: summary.projects_without_guide, label: "approved projects without a primary guide", href: "/dashboard/admin/projects" },
    { n: summary.overdue_submissions, label: "overdue milestone submissions", href: "/dashboard/admin/submissions" },
    { n: summary.submissions_awaiting_review, label: "submissions waiting for faculty review", href: "/dashboard/admin/submissions?status=Submitted" },
  ].filter((a) => a.n > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Total projects" value={summary.total_projects} />
        <Stat label="Active" value={summary.active_projects} tone="blue" hint="On schedule" />
        <Stat label="Delayed" value={summary.delayed_projects} tone="red" hint="Have overdue milestones" />
        <Stat label="Pending" value={summary.pending_projects} tone="amber" hint="Proposal stage" />
        <Stat label="Completed" value={summary.completed_projects} tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Needs action">
          {actions.length === 0 ? (
            <EmptyState>Nothing waiting on you.</EmptyState>
          ) : (
            <ul className="space-y-2 text-xs">
              {actions.map((a) => (
                <li key={a.label}>
                  <Link
                    href={a.href}
                    className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2.5 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{a.n}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">{a.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="lg:col-span-2">
          <Section
            title="Delayed and pending projects"
            actions={
              <Link href="/dashboard/admin/reports" className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">
                All reports →
              </Link>
            }
          >
            {attention.length === 0 ? (
              <EmptyState>Every project is on schedule.</EmptyState>
            ) : (
              <Table head={["Project", "State", "Guide", "Progress", "Overdue"]}>
                {attention.map((p) => (
                  <tr key={String(p.project_id)}>
                    <Td>
                      <Link href={`/dashboard/admin/projects/${p.project_id}`} className="font-semibold hover:underline">
                        {String(p.project_title)}
                      </Link>
                      <div className="text-[11px] text-zinc-500">{String(p.group_name)}</div>
                    </Td>
                    <Td>
                      <StatusBadge status={String(p.progress_state)} />
                    </Td>
                    <Td>{p.primary_mentor_name ? String(p.primary_mentor_name) : <span className="text-rose-600">None</span>}</Td>
                    <Td className="min-w-28">
                      <div className="mb-0.5 text-[11px]">{num(p.completion_pct, 1)}%</div>
                      <ProgressBar value={Number(p.completion_pct)} />
                    </Td>
                    <Td>{String(p.overdue_milestones)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
