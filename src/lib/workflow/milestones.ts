import { z } from "zod";
import { query } from "@/lib/mysql";
import { ServiceError } from "@/lib/http";

export interface MilestoneRecord {
  milestone_id: number;
  academic_year: string;
  milestone_order: number;
  title: string;
  description: string | null;
  due_date: string | Date;
  max_marks: number | string;
  weightage: number | string;
  created_by_name: string | null;
  submission_count: number;
  is_past_due: number;
}

const academicYear = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, "Academic year must look like 2026-2027.");

export const milestoneSchema = z.object({
  academic_year: academicYear,
  milestone_order: z.coerce.number().int().min(1).max(20),
  title: z.string().trim().min(3).max(120),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  due_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/, "Use a date like 2026-12-01 or 2026-12-01T23:59.")
    .transform((v) => (v.length === 10 ? `${v} 23:59:59` : v.replace("T", " "))),
  max_marks: z.coerce.number().positive().max(500),
  weightage: z.coerce.number().positive().max(100),
});
export type MilestoneInput = z.infer<typeof milestoneSchema>;

export const milestoneUpdateSchema = milestoneSchema.partial();

export async function listMilestones(academicYearFilter?: string): Promise<MilestoneRecord[]> {
  const where = academicYearFilter ? "WHERE m.academic_year = ?" : "";
  return query<MilestoneRecord[]>(
    `SELECT m.milestone_id, m.academic_year, m.milestone_order, m.title, m.description, m.due_date,
            m.max_marks, m.weightage, u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM submissions s WHERE s.milestone_id = m.milestone_id) AS submission_count,
            (m.due_date < NOW()) AS is_past_due
       FROM milestones m
       LEFT JOIN users u ON u.user_id = m.created_by
       ${where}
      ORDER BY m.academic_year DESC, m.milestone_order ASC`,
    academicYearFilter ? [academicYearFilter] : []
  );
}

export async function listAcademicYears(): Promise<string[]> {
  const rows = await query<Array<{ academic_year: string }>>(
    `SELECT academic_year FROM project_groups
     UNION SELECT academic_year FROM milestones
     ORDER BY academic_year DESC`
  );
  return rows.map((r) => r.academic_year);
}

export async function createMilestone(input: MilestoneInput, createdBy: number): Promise<number> {
  const result = await query<{ insertId: number }>(
    `INSERT INTO milestones (academic_year, milestone_order, title, description, due_date,
                             max_marks, weightage, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.academic_year,
      input.milestone_order,
      input.title,
      input.description,
      input.due_date,
      input.max_marks,
      input.weightage,
      createdBy,
    ]
  );
  return result.insertId;
}

const UPDATABLE: Array<keyof MilestoneInput> = [
  "academic_year",
  "milestone_order",
  "title",
  "description",
  "due_date",
  "max_marks",
  "weightage",
];

export async function updateMilestone(id: number, input: Partial<MilestoneInput>): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of UPDATABLE) {
    if (input[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(input[key]);
    }
  }
  if (sets.length === 0) throw new ServiceError("No changes supplied.");
  params.push(id);
  const result = await query<{ affectedRows: number }>(
    `UPDATE milestones SET ${sets.join(", ")} WHERE milestone_id = ?`,
    params
  );
  if (result.affectedRows === 0) throw new ServiceError("Milestone not found.", 404);
}

export async function deleteMilestone(id: number): Promise<void> {
  const [row] = await query<Array<{ n: number }>>(
    `SELECT (SELECT COUNT(*) FROM submissions WHERE milestone_id = ?) +
            (SELECT COUNT(*) FROM evaluations WHERE milestone_id = ?) AS n`,
    [id, id]
  );
  if (Number(row?.n || 0) > 0) {
    throw new ServiceError("This milestone already has submissions or evaluations and cannot be deleted.", 409);
  }
  const result = await query<{ affectedRows: number }>("DELETE FROM milestones WHERE milestone_id = ?", [id]);
  if (result.affectedRows === 0) throw new ServiceError("Milestone not found.", 404);
}
