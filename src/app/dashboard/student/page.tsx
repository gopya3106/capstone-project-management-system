import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { getStudentDashboard, listNotifications, countUnread } from "@/lib/workflow";
import {
  PageShell,
  Section,
  Stat,
  StatusBadge,
  Badge,
  EmptyState,
  Table,
  Td,
  ProgressBar,
  formatDate,
  num,
} from "@/components/ui";
import { ProposalForm, SubmissionForm } from "@/components/workflow/StudentForms";
import { NotificationsPanel } from "@/components/workflow/NotificationsPanel";
import { toNotificationItems } from "@/components/workflow/serialize";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  let session;
  try {
    session = await requireStudent();
  } catch {
    redirect("/login");
  }

  const [data, notifications, unread] = await Promise.all([
    getStudentDashboard(session.userId),
    listNotifications(session.userId, 20),
    countUnread(session.userId),
  ]);
  const { ctx, progress, guides, team, proposals, milestones, marks, finalResult } = data;

  const latestProposal = proposals[0];
  const hasApproved = proposals.some((p) => p.proposal_status === "Approved");
  const hasPending = proposals.some((p) => p.proposal_status === "Submitted" || p.proposal_status === "Under Review");
  const canPropose = Boolean(ctx.group_id) && !hasApproved && !hasPending;
  const canSubmit = ctx.project_status === "Approved" || ctx.project_status === "In Progress";
  const marksByMilestone = new Map(marks.map((m) => [m.milestone_id, m]));

  return (
    <PageShell
      badge="Student Portal"
      badgeTone="blue"
      title={`Welcome, ${ctx.full_name}`}
      subtitle={
        <>
          {ctx.usn} · {ctx.department} · Batch {ctx.batch}
        </>
      }
    >
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Group" value={ctx.group_name || "Not assigned"} hint={ctx.member_role ? `You are the ${ctx.member_role.toLowerCase()}` : "Ask your coordinator"} />
        <Stat
          label="Project status"
          value={<StatusBadge status={ctx.project_status || (latestProposal ? `Proposal ${latestProposal.proposal_status}` : "No proposal")} />}
          hint={progress ? <StatusBadge status={progress.progress_state} /> : undefined}
        />
        <Stat
          label="Milestones submitted"
          value={progress ? `${progress.milestones_submitted}/${progress.total_milestones}` : "—"}
          hint={progress && progress.overdue_milestones > 0 ? `${progress.overdue_milestones} overdue` : undefined}
          tone="red"
        />
        <Stat
          label="Running total"
          value={finalResult ? `${num(finalResult.weighted_total, 2)} / 100` : "—"}
          hint={finalResult ? (finalResult.grade === "IP" ? "In progress" : `Grade ${finalResult.grade}`) : "No marks yet"}
          tone="purple"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Project */}
          <Section title="My project" description={ctx.academic_year ? `Academic year ${ctx.academic_year}` : undefined}>
            {!ctx.group_id ? (
              <EmptyState>You are not in a capstone group yet. Your coordinator or admin forms the groups.</EmptyState>
            ) : !ctx.project_id ? (
              <EmptyState>
                Your group has no approved project yet. Submit a proposal below; once the coordinator approves it, the project
                is created automatically.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{ctx.project_title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={ctx.project_status} />
                    {progress?.project_domain && <Badge>{progress.project_domain}</Badge>}
                  </div>
                </div>
                {progress && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-500">
                      <span>Milestone completion</span>
                      <span>{num(progress.completion_pct, 1)}%</span>
                    </div>
                    <ProgressBar value={Number(progress.completion_pct)} />
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Guides</h4>
                    {guides.length === 0 ? (
                      <p className="mt-1 text-xs text-zinc-500">Not allocated yet.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-xs">
                        {guides.map((g) => (
                          <li key={g.mentor_id}>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{g.full_name}</span>{" "}
                            <span className="text-zinc-500">
                              ({g.mentor_role}) · {g.email}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Team</h4>
                    <ul className="mt-1 space-y-1 text-xs">
                      {team.map((t) => (
                        <li key={t.usn}>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{t.full_name}</span>{" "}
                          <span className="font-mono text-[10px] text-zinc-500">{t.usn}</span>
                          {t.member_role === "Leader" && <span className="ml-1 text-[10px] text-zinc-500">(Leader)</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* Milestones & submissions */}
          {ctx.group_id && (
            <Section
              title="Milestones & submissions"
              description="Submit a shared link to each document. Resubmitting creates a new version; anything after the due date is marked late."
            >
              {milestones.length === 0 ? (
                <EmptyState>No milestones have been published for {ctx.academic_year} yet.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {milestones.map((m) => {
                    const mark = marksByMilestone.get(m.milestone_id);
                    const s = m.latest;
                    return (
                      <div key={m.milestone_id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {m.milestone_order}. {m.title}
                            </div>
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              Due {formatDate(m.due_date, true)} · {num(m.max_marks)} marks · {num(m.weightage)}% weight
                            </div>
                            {m.description && <p className="mt-1 text-[11px] text-zinc-500">{m.description}</p>}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {s ? (
                              <>
                                <StatusBadge status={s.submission_status} />
                                <StatusBadge status={s.is_late ? "Late" : "On time"} />
                              </>
                            ) : m.is_past_due ? (
                              <Badge tone="red">Overdue</Badge>
                            ) : (
                              <Badge>Not submitted</Badge>
                            )}
                            {mark && (
                              <Badge tone="purple">
                                {num(mark.avg_marks, 2)}/{num(mark.max_marks)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {s && (
                          <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800/50">
                            <a href={s.document_url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                              {s.document_title}
                            </a>{" "}
                            <span className="text-zinc-500">
                              v{s.version_no} · {formatDate(s.submitted_at, true)} by {s.submitted_by_name}
                              {m.versions > 1 ? ` · ${m.versions} versions` : ""}
                            </span>
                            {s.feedback && (
                              <p className="mt-1.5 text-zinc-700 dark:text-zinc-300">
                                <span className="font-semibold">Guide feedback:</span> {s.feedback}
                                {s.reviewed_by_name ? <span className="text-zinc-500"> ({s.reviewed_by_name})</span> : null}
                              </p>
                            )}
                          </div>
                        )}
                        {canSubmit && (
                          <div className="mt-3">
                            <SubmissionForm
                              milestoneId={m.milestone_id}
                              milestoneTitle={m.title}
                              isResubmission={Boolean(s)}
                              isPastDue={Boolean(m.is_past_due)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!canSubmit && (
                    <p className="text-[11px] text-zinc-500">Submissions open once your proposal is approved.</p>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Proposal */}
          {ctx.group_id && (
            <Section
              title="Project proposal"
              description="One proposal is reviewed at a time. If it is rejected, revise it and submit a new version."
            >
              {proposals.length > 0 && (
                <div className="mb-4">
                  <Table head={["Version", "Title", "Status", "Submitted", "Review"]}>
                    {proposals.map((p) => (
                      <tr key={p.proposal_id}>
                        <Td>v{p.version_no}</Td>
                        <Td className="font-semibold">{p.title}</Td>
                        <Td>
                          <StatusBadge status={p.proposal_status} />
                        </Td>
                        <Td>{formatDate(p.submitted_at)}</Td>
                        <Td>
                          {p.review_comments ? (
                            <span>
                              {p.review_comments}
                              {p.reviewed_by_name ? <span className="text-zinc-500"> ({p.reviewed_by_name})</span> : null}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                </div>
              )}
              {canPropose ? (
                <ProposalForm defaultTitle={latestProposal?.proposal_status === "Rejected" ? latestProposal.title : ""} />
              ) : hasPending ? (
                <p className="text-xs text-zinc-500">Your proposal is awaiting the coordinator&apos;s review.</p>
              ) : hasApproved ? (
                <p className="text-xs text-zinc-500">Your proposal is approved.</p>
              ) : null}
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <NotificationsPanel items={toNotificationItems(notifications)} unread={unread} />

          {marks.length > 0 && (
            <Section title="My marks">
              <Table head={["Milestone", "Marks", "Weighted"]}>
                {marks.map((m) => (
                  <tr key={m.milestone_id}>
                    <Td>{m.milestone_title}</Td>
                    <Td>
                      {num(m.avg_marks, 2)}/{num(m.max_marks)}
                    </Td>
                    <Td>
                      {num(m.weighted_marks, 2)} / {num(m.weightage)}
                    </Td>
                  </tr>
                ))}
              </Table>
              {finalResult && (
                <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                  Total so far: <strong>{num(finalResult.weighted_total, 2)}/100</strong>
                  {finalResult.grade === "IP" ? " (final grade after all milestones are evaluated)" : ` · Grade ${finalResult.grade}`}
                </p>
              )}
            </Section>
          )}
        </div>
      </div>
    </PageShell>
  );
}
