import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { listAcademicYears, listMilestones } from "@/lib/workflow";
import { AdminNav } from "@/components/admin/AdminNav";
import { PageShell, Section, EmptyState, Table, Td, StatusBadge, Badge, formatDate, num } from "@/components/ui";
import { MilestoneEditor, MilestoneRowActions, MilestoneRow } from "@/components/workflow/StaffForms";
import { toDateTimeLocal } from "@/components/workflow/serialize";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ year?: string }> };

export default async function MilestonesPage({ searchParams }: Props) {
  let session;
  try {
    session = await requireStaff();
  } catch {
    redirect("/login");
  }

  const years = await listAcademicYears();
  const requested = (await searchParams).year;
  const year = requested && /^\d{4}-\d{4}$/.test(requested) ? requested : years[0] || "2026-2027";
  const milestones = await listMilestones(year);

  const rows: MilestoneRow[] = milestones.map((m) => ({
    milestone_id: m.milestone_id,
    academic_year: m.academic_year,
    milestone_order: m.milestone_order,
    title: m.title,
    description: m.description,
    due_date: toDateTimeLocal(m.due_date),
    due_label: formatDate(m.due_date, true),
    max_marks: Number(m.max_marks),
    weightage: Number(m.weightage),
    submission_count: Number(m.submission_count),
    is_past_due: Boolean(m.is_past_due),
  }));
  const totalWeight = rows.reduce((sum, r) => sum + r.weightage, 0);
  const nextOrder = rows.reduce((max, r) => Math.max(max, r.milestone_order), 0) + 1;

  return (
    <PageShell
      badge={session.role === "Coordinator" ? "Coordinator Console" : "Departmental Coordinator"}
      badgeTone="purple"
      title="Milestones"
      subtitle="Review checkpoints for each academic year. Weightages must add up to at most 100% (enforced by a trigger)."
      nav={<AdminNav role={session.role} />}
    >
      <div className="flex flex-wrap items-center gap-1">
        {(years.includes(year) ? years : [year, ...years]).map((y) => (
          <Link
            key={y}
            href={`/dashboard/admin/milestones?year=${y}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              y === year
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      <Section
        title={`Milestones for ${year}`}
        actions={<Badge tone={totalWeight === 100 ? "green" : "amber"}>Total weight {num(totalWeight, 1)}%</Badge>}
      >
        {rows.length === 0 ? (
          <EmptyState>No milestones yet for {year}. Add the first one below.</EmptyState>
        ) : (
          <Table head={["#", "Milestone", "Due", "Marks", "Weight", "Submissions", ""]}>
            {rows.map((r) => (
              <tr key={r.milestone_id}>
                <Td>{r.milestone_order}</Td>
                <Td>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.title}</div>
                  {r.description && <div className="text-[11px] text-zinc-500">{r.description}</div>}
                </Td>
                <Td>
                  {r.due_label} {r.is_past_due && <StatusBadge status="Closed" />}
                </Td>
                <Td>{num(r.max_marks)}</Td>
                <Td>{num(r.weightage, 1)}%</Td>
                <Td>{r.submission_count}</Td>
                <Td>
                  <MilestoneRowActions row={r} defaultYear={year} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Add milestone">
        <MilestoneEditor defaultYear={year} nextOrder={nextOrder} />
      </Section>
    </PageShell>
  );
}
