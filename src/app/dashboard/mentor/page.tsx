import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMentor } from "@/lib/auth";
import { getMentorDashboard, listNotifications, countUnread } from "@/lib/workflow";
import {
  PageShell,
  Section,
  Stat,
  StatusBadge,
  EmptyState,
  Table,
  Td,
  ProgressBar,
  formatDate,
  num,
  secondaryButtonClass,
} from "@/components/ui";
import { NotificationsPanel } from "@/components/workflow/NotificationsPanel";
import { toNotificationItems } from "@/components/workflow/serialize";

export const dynamic = "force-dynamic";

export default async function MentorDashboardPage() {
  let session;
  try {
    session = await requireMentor();
  } catch {
    redirect("/login");
  }

  const [{ mentor, projects, awaitingReview }, notifications, unread] = await Promise.all([
    getMentorDashboard(session.userId),
    listNotifications(session.userId, 20),
    countUnread(session.userId),
  ]);
  const delayed = projects.filter((p) => p.progress_state === "Delayed").length;

  return (
    <PageShell
      badge="Faculty Guide Portal"
      badgeTone="green"
      title={mentor.full_name}
      subtitle={
        <>
          {mentor.designation || "Faculty"} · {mentor.department} · {mentor.employee_id}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Assigned projects" value={projects.length} hint={`Capacity ${mentor.max_projects}`} />
        <Stat
          label="Awaiting your review"
          value={awaitingReview.length}
          hint={awaitingReview.length ? "Open a project to review" : "All caught up"}
          tone={awaitingReview.length ? "amber" : "green"}
        />
        <Stat label="Delayed projects" value={delayed} hint={delayed ? "Have overdue milestones" : "None"} tone={delayed ? "red" : "green"} />
        <Stat label="Availability" value={<StatusBadge status={mentor.availability_status} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="My projects">
            {projects.length === 0 ? (
              <EmptyState>No projects are allocated to you yet.</EmptyState>
            ) : (
              <Table head={["Project", "Role", "Status", "Progress", "To review", ""]}>
                {projects.map((p) => (
                  <tr key={p.project_id}>
                    <Td>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{p.project_title}</div>
                      <div className="text-[11px] text-zinc-500">
                        {p.group_name} · {p.academic_year}
                      </div>
                    </Td>
                    <Td>{p.mentor_role}</Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={p.project_status} />
                        <StatusBadge status={p.progress_state} />
                      </div>
                    </Td>
                    <Td className="min-w-32">
                      <div className="mb-1 text-[11px] text-zinc-500">
                        {p.milestones_submitted}/{p.total_milestones} submitted · {p.milestones_evaluated} evaluated
                      </div>
                      <ProgressBar value={Number(p.completion_pct)} />
                    </Td>
                    <Td>{p.awaiting_review > 0 ? <strong className="text-amber-600">{p.awaiting_review}</strong> : "0"}</Td>
                    <Td>
                      <Link href={`/dashboard/mentor/projects/${p.project_id}`} className={secondaryButtonClass}>
                        Open
                      </Link>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <Section title="Submissions awaiting review">
            {awaitingReview.length === 0 ? (
              <EmptyState>Nothing waiting.</EmptyState>
            ) : (
              <Table head={["Project", "Milestone", "Document", "Submitted", ""]}>
                {awaitingReview.map((s) => (
                  <tr key={s.submission_id}>
                    <Td>{s.project_title}</Td>
                    <Td>{s.milestone_title}</Td>
                    <Td>
                      <a href={s.document_url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                        {s.document_title}
                      </a>{" "}
                      <span className="text-zinc-500">v{s.version_no}</span>
                    </Td>
                    <Td>
                      {formatDate(s.submitted_at, true)} {s.is_late ? <StatusBadge status="Late" /> : null}
                    </Td>
                    <Td>
                      <Link href={`/dashboard/mentor/projects/${s.project_id}#submissions`} className={secondaryButtonClass}>
                        Review
                      </Link>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </div>
        <div className="space-y-6">
          <NotificationsPanel items={toNotificationItems(notifications)} unread={unread} />
          <p className="px-1 text-[11px] text-zinc-500">
            Workload: {projects.length} of {mentor.max_projects} projects ({num((projects.length / mentor.max_projects) * 100)}%)
          </p>
        </div>
      </div>
    </PageShell>
  );
}
