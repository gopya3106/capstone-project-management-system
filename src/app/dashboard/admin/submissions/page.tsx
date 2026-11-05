import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { listSubmissions, runReport, SUBMISSION_STATUSES, SubmissionStatus } from "@/lib/workflow";
import { AdminNav } from "@/components/admin/AdminNav";
import { PageShell, Section, EmptyState, Table, Td, StatusBadge, Stat, formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string; late?: string }> };

export default async function SubmissionsPage({ searchParams }: Props) {
  let session;
  try {
    session = await requireStaff();
  } catch {
    redirect("/login");
  }

  const sp = await searchParams;
  const status = (SUBMISSION_STATUSES as readonly string[]).includes(sp.status || "")
    ? (sp.status as SubmissionStatus)
    : undefined;
  const lateOnly = sp.late === "1";

  const [submissions, pending] = await Promise.all([
    listSubmissions({ status, lateOnly }),
    runReport("pending-submissions"),
  ]);
  const overdue = pending.filter((p) => Number(p.is_overdue) === 1);
  const filters: Array<{ label: string; href: string; active: boolean }> = [
    { label: "All", href: "/dashboard/admin/submissions", active: !status && !lateOnly },
    { label: "Late only", href: "/dashboard/admin/submissions?late=1", active: lateOnly },
    ...SUBMISSION_STATUSES.map((s) => ({
      label: s,
      href: `/dashboard/admin/submissions?status=${encodeURIComponent(s)}`,
      active: status === s,
    })),
  ];

  return (
    <PageShell
      badge={session.role === "Coordinator" ? "Coordinator Console" : "Departmental Coordinator"}
      badgeTone="purple"
      title="Submissions"
      subtitle="Every milestone document, with late flags set by the database trigger, plus what is still missing."
      nav={<AdminNav role={session.role} />}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Shown" value={submissions.length} hint={lateOnly ? "Late submissions" : status || "All statuses"} />
        <Stat label="Overdue (not submitted)" value={overdue.length} tone={overdue.length ? "red" : "green"} hint="Past the due date" />
        <Stat label="Upcoming (not submitted)" value={pending.length - overdue.length} tone="amber" hint="Still within the deadline" />
      </div>

      <Section title="Overdue: not yet submitted" description="From the view v_pending_submissions.">
        {overdue.length === 0 ? (
          <EmptyState>Nothing overdue.</EmptyState>
        ) : (
          <Table head={["Project", "Group", "Milestone", "Due", "Days overdue", "Guide"]}>
            {overdue.map((p) => (
              <tr key={`${p.project_id}-${p.milestone_id}`}>
                <Td className="font-semibold">{String(p.project_title)}</Td>
                <Td>{String(p.group_name)}</Td>
                <Td>{String(p.milestone_title)}</Td>
                <Td>{formatDate(p.due_date as Date, true)}</Td>
                <Td className="font-semibold text-rose-600">{String(p.days_overdue)}</Td>
                <Td>{p.primary_mentor_name ? String(p.primary_mentor_name) : "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <div className="flex flex-wrap gap-1">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.href}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              f.active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Section title="Submitted documents">
        {submissions.length === 0 ? (
          <EmptyState>No submissions match this filter.</EmptyState>
        ) : (
          <Table head={["Project", "Milestone", "Document", "Submitted", "Timing", "Status", "Reviewed by"]}>
            {submissions.map((s) => (
              <tr key={s.submission_id}>
                <Td>
                  <Link href={`/dashboard/admin/projects/${s.project_id}`} className="font-semibold hover:underline">
                    {s.project_title}
                  </Link>
                  <div className="text-[11px] text-zinc-500">{s.group_name}</div>
                </Td>
                <Td>
                  {s.milestone_order}. {s.milestone_title}
                </Td>
                <Td>
                  <a href={s.document_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {s.document_title}
                  </a>{" "}
                  <span className="text-zinc-500">v{s.version_no}</span>
                </Td>
                <Td>{formatDate(s.submitted_at, true)}</Td>
                <Td>
                  <StatusBadge status={s.is_late ? "Late" : "On time"} />
                </Td>
                <Td>
                  <StatusBadge status={s.submission_status} />
                </Td>
                <Td>{s.reviewed_by_name || "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </PageShell>
  );
}
