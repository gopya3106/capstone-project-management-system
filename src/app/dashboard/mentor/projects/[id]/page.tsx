import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMentor } from "@/lib/auth";
import {
  assertMentorOnProject,
  getMentorContext,
  getMilestoneProgress,
  getProjectProgress,
  listFinalResults,
  listProjectEvaluations,
  listProjectGuides,
  listProjectMarks,
  listProjectSubmissions,
} from "@/lib/workflow";
import { getProjectById } from "@/lib/projects";
import { getActivityTimeline } from "@/lib/activity";
import {
  PageShell,
  Section,
  StatusBadge,
  EmptyState,
  Table,
  Td,
  Badge,
  formatDate,
  num,
  secondaryButtonClass,
} from "@/components/ui";
import { EvaluationForm, SubmissionReviewForm } from "@/components/workflow/MentorForms";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function MentorProjectPage({ params }: Props) {
  let session;
  try {
    session = await requireMentor();
  } catch {
    redirect("/login");
  }

  const projectId = Number((await params).id);
  if (!Number.isInteger(projectId) || projectId <= 0) notFound();

  const mentor = await getMentorContext(session.userId);
  try {
    await assertMentorOnProject(mentor.mentor_id, projectId);
  } catch {
    notFound();
  }

  const [project, progress, guides, submissions, evaluations, marks, finals, timeline] = await Promise.all([
    getProjectById(projectId),
    getProjectProgress(projectId),
    listProjectGuides(projectId),
    listProjectSubmissions(projectId),
    listProjectEvaluations(projectId),
    listProjectMarks(projectId),
    listFinalResults(projectId),
    getActivityTimeline(projectId, 15),
  ]);
  if (!project || !progress) notFound();

  const milestones = await getMilestoneProgress(progress.academic_year, projectId);
  const myEvaluated = new Set(
    evaluations.filter((e) => e.evaluator_id === mentor.mentor_id).map((e) => e.milestone_id)
  );

  return (
    <PageShell
      badge="Faculty Guide Portal"
      badgeTone="green"
      title={project.project_title}
      subtitle={
        <>
          {project.group_name} · {project.academic_year} · Guides: {guides.map((g) => `${g.full_name} (${g.mentor_role})`).join(", ")}
        </>
      }
      actions={
        <Link href="/dashboard/mentor" className={secondaryButtonClass}>
          ← My projects
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={project.project_status} />
        <StatusBadge status={progress.progress_state} />
        <Badge>
          {progress.milestones_submitted}/{progress.total_milestones} milestones submitted
        </Badge>
        {progress.overdue_milestones > 0 && <Badge tone="red">{progress.overdue_milestones} overdue</Badge>}
      </div>

      <Section title="Project">
        <div className="grid gap-4 text-xs sm:grid-cols-2">
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Problem statement</h4>
            <p className="mt-1 whitespace-pre-line text-zinc-700 dark:text-zinc-300">{project.problem_statement || "—"}</p>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Technology</h4>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">{project.technology_stack || "—"}</p>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Team</h4>
              <ul className="mt-1 space-y-0.5 text-zinc-700 dark:text-zinc-300">
                {project.team_members.map((t) => (
                  <li key={t.student_id}>
                    {t.full_name} <span className="font-mono text-[10px] text-zinc-500">{t.usn}</span>
                    {t.member_role === "Leader" ? " (Leader)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section id="submissions" title="Submissions" description="Latest version first within each milestone.">
        {submissions.length === 0 ? (
          <EmptyState>No documents submitted yet.</EmptyState>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.submission_id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="text-xs">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {s.milestone_order}. {s.milestone_title} · v{s.version_no}
                    </div>
                    <a href={s.document_url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                      {s.document_title}
                    </a>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {s.submitted_by_name} · {formatDate(s.submitted_at, true)} (due {formatDate(s.due_date, true)})
                    </div>
                    {s.notes && <p className="mt-1 text-zinc-600 dark:text-zinc-400">“{s.notes}”</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <StatusBadge status={s.submission_status} />
                    <StatusBadge status={s.is_late ? "Late" : "On time"} />
                  </div>
                </div>
                <div className="mt-3">
                  <SubmissionReviewForm submissionId={s.submission_id} currentStatus={s.submission_status} currentFeedback={s.feedback} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Evaluation" description="Enter individual marks for each student. Saving recalculates final marks (sp_calculate_final_marks).">
        <EvaluationForm
          projectId={projectId}
          milestones={milestones.map((m) => ({
            milestone_id: m.milestone_id,
            label: `${m.milestone_order}. ${m.title} (/${num(m.max_marks)})`,
            evaluated: myEvaluated.has(m.milestone_id),
          }))}
        />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Marks so far" description="Average across all evaluators, per milestone.">
          {marks.length === 0 ? (
            <EmptyState>No marks recorded yet.</EmptyState>
          ) : (
            <Table head={["Student", "Milestone", "Avg", "Weighted"]}>
              {marks.map((m) => (
                <tr key={`${m.student_id}-${m.milestone_id}`}>
                  <Td>{m.student_name}</Td>
                  <Td>{m.milestone_title}</Td>
                  <Td>
                    {num(m.avg_marks, 2)}/{num(m.max_marks)}
                  </Td>
                  <Td>{num(m.weighted_marks, 2)}</Td>
                </tr>
              ))}
            </Table>
          )}
          {finals.length > 0 && (
            <div className="mt-4">
              <Table head={["Student", "Total /100", "Grade"]}>
                {finals.map((f) => (
                  <tr key={f.student_id}>
                    <Td>{f.student_name}</Td>
                    <Td className="font-semibold">{num(f.weighted_total, 2)}</Td>
                    <Td>{f.grade === "IP" ? <Badge tone="amber">In progress</Badge> : <Badge tone="purple">{f.grade}</Badge>}</Td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Section>

        <Section title="Activity" description={timeline.length ? "From the MongoDB activity log." : undefined}>
          {timeline.length === 0 ? (
            <EmptyState>No activity log available (MongoDB not configured, or nothing recorded yet).</EmptyState>
          ) : (
            <ul className="space-y-2 text-xs">
              {timeline.map((a) => (
                <li key={String(a._id)} className="border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                  <div className="text-zinc-800 dark:text-zinc-200">{a.description}</div>
                  <div className="text-[10px] text-zinc-500">{formatDate(a.timestamp, true)}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PageShell>
  );
}
