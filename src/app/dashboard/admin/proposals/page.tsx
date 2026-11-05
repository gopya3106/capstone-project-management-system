import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getProposalStats, listProposals, PROPOSAL_STATUSES, ProposalStatus } from "@/lib/workflow";
import { AdminNav } from "@/components/admin/AdminNav";
import { PageShell, Section, Stat, StatusBadge, EmptyState, formatDate } from "@/components/ui";
import { ProposalReviewForm } from "@/components/workflow/StaffForms";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string }> };

const FILTERS = ["Pending", ...PROPOSAL_STATUSES, "All"] as const;

export default async function ProposalsPage({ searchParams }: Props) {
  let session;
  try {
    session = await requireStaff();
  } catch {
    redirect("/login");
  }

  const raw = (await searchParams).status || "Pending";
  const filter = (FILTERS as readonly string[]).includes(raw) ? raw : "Pending";
  const [proposals, stats] = await Promise.all([
    listProposals(filter === "All" ? undefined : (filter as ProposalStatus | "Pending")),
    getProposalStats(),
  ]);

  return (
    <PageShell
      badge={session.role === "Coordinator" ? "Coordinator Console" : "Departmental Coordinator"}
      badgeTone="purple"
      title="Project Proposals"
      subtitle="Approve, reject, or mark proposals under review. Approving creates or updates the group's project (sp_review_proposal)."
      nav={<AdminNav role={session.role} />}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Submitted" value={stats.Submitted} hint="Not opened yet" tone="blue" />
        <Stat label="Under review" value={stats["Under Review"]} tone="purple" hint="Being assessed" />
        <Stat label="Approved" value={stats.Approved} tone="green" hint="Projects created" />
        <Stat label="Rejected" value={stats.Rejected} tone="red" hint="Groups can resubmit" />
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/dashboard/admin/proposals?status=${encodeURIComponent(f)}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              f === filter
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {f === "Pending" ? "Awaiting decision" : f}
          </Link>
        ))}
      </div>

      <Section title={`${proposals.length} proposal${proposals.length === 1 ? "" : "s"}`}>
        {proposals.length === 0 ? (
          <EmptyState>No proposals in this view.</EmptyState>
        ) : (
          <div className="space-y-4">
            {proposals.map((p) => {
              const pending = p.proposal_status === "Submitted" || p.proposal_status === "Under Review";
              return (
                <article key={p.proposal_id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{p.title}</h3>
                      <p className="text-[11px] text-zinc-500">
                        {p.group_name} ({p.member_count} members) · {p.academic_year} · v{p.version_no} · submitted{" "}
                        {formatDate(p.submitted_at, true)} by {p.submitted_by_name} ({p.submitted_by_usn})
                      </p>
                    </div>
                    <StatusBadge status={p.proposal_status} />
                  </div>
                  <p className="mt-3 whitespace-pre-line text-xs text-zinc-700 dark:text-zinc-300">{p.abstract}</p>
                  <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    {p.objectives && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Objectives</dt>
                        <dd className="mt-0.5 whitespace-pre-line text-zinc-700 dark:text-zinc-300">{p.objectives}</dd>
                      </div>
                    )}
                    {p.methodology && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Methodology</dt>
                        <dd className="mt-0.5 whitespace-pre-line text-zinc-700 dark:text-zinc-300">{p.methodology}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Technology / domain</dt>
                      <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                        {p.technology_stack || "—"} · {p.project_domain || "—"}
                      </dd>
                    </div>
                  </dl>
                  {pending ? (
                    <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <ProposalReviewForm proposalId={p.proposal_id} status={p.proposal_status} />
                    </div>
                  ) : (
                    p.review_comments && (
                      <p className="mt-3 rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                        <strong>{p.reviewed_by_name || "Reviewer"}</strong> ({formatDate(p.reviewed_at)}): {p.review_comments}
                      </p>
                    )
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Section>
    </PageShell>
  );
}
