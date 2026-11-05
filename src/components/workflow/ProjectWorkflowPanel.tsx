import Link from "next/link";
import {
  getMilestoneProgress,
  getProjectProgress,
  listFinalResults,
  listGroupProposals,
} from "@/lib/workflow";
import { Section, StatusBadge, Table, Td, EmptyState, Badge, formatDate, num } from "@/components/ui";
import { RecalculateButton } from "./StaffForms";

/** Proposal history, milestone submissions and marks for one project (staff view). */
export async function ProjectWorkflowPanel({ projectId, groupId }: { projectId: number; groupId: number }) {
  const progress = await getProjectProgress(projectId);
  if (!progress) return null;
  const [proposals, milestones, finals] = await Promise.all([
    listGroupProposals(groupId),
    getMilestoneProgress(progress.academic_year, projectId),
    listFinalResults(projectId),
  ]);

  return (
    <div className="space-y-6">
      <Section
        title="Milestones & submissions"
        description={
          <>
            {progress.milestones_submitted}/{progress.total_milestones} submitted · {progress.milestones_evaluated} evaluated ·{" "}
            <StatusBadge status={progress.progress_state} />
          </>
        }
        actions={
          <Link href="/dashboard/admin/milestones" className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">
            Manage milestones →
          </Link>
        }
      >
        {milestones.length === 0 ? (
          <EmptyState>No milestones defined for {progress.academic_year}.</EmptyState>
        ) : (
          <Table head={["#", "Milestone", "Due", "Latest submission", "Timing", "Review"]}>
            {milestones.map((m) => (
              <tr key={m.milestone_id}>
                <Td>{m.milestone_order}</Td>
                <Td className="font-medium">{m.title}</Td>
                <Td>{formatDate(m.due_date, true)}</Td>
                <Td>
                  {m.latest ? (
                    <>
                      <a href={m.latest.document_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                        {m.latest.document_title}
                      </a>{" "}
                      <span className="text-zinc-500">
                        v{m.latest.version_no} · {formatDate(m.latest.submitted_at, true)}
                      </span>
                    </>
                  ) : m.is_past_due ? (
                    <Badge tone="red">Overdue</Badge>
                  ) : (
                    <span className="text-zinc-400">Not yet</span>
                  )}
                </Td>
                <Td>{m.latest ? <StatusBadge status={m.latest.is_late ? "Late" : "On time"} /> : "—"}</Td>
                <Td>{m.latest ? <StatusBadge status={m.latest.submission_status} /> : "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Proposal history">
          {proposals.length === 0 ? (
            <EmptyState>No proposals submitted by this group.</EmptyState>
          ) : (
            <Table head={["Ver", "Title", "Status", "Reviewed"]}>
              {proposals.map((p) => (
                <tr key={p.proposal_id}>
                  <Td>v{p.version_no}</Td>
                  <Td>{p.title}</Td>
                  <Td>
                    <StatusBadge status={p.proposal_status} />
                  </Td>
                  <Td>{p.reviewed_by_name ? `${p.reviewed_by_name}, ${formatDate(p.reviewed_at)}` : "—"}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="Final marks" actions={finals.length > 0 ? <RecalculateButton projectId={projectId} /> : undefined}>
          {finals.length === 0 ? (
            <EmptyState>No evaluations recorded yet.</EmptyState>
          ) : (
            <Table head={["Student", "Milestones", "Total /100", "Grade"]}>
              {finals.map((f) => (
                <tr key={f.student_id}>
                  <Td>
                    {f.student_name} <span className="font-mono text-[10px] text-zinc-500">{f.usn}</span>
                  </Td>
                  <Td>{f.milestones_evaluated}</Td>
                  <Td className="font-semibold">{num(f.weighted_total, 2)}</Td>
                  <Td>{f.grade === "IP" ? <Badge tone="amber">In progress</Badge> : <Badge tone="purple">{f.grade}</Badge>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>
    </div>
  );
}
