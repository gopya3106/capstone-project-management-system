import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { query, withConnection, withTransaction } from "@/lib/mysql";
import { ServiceError } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { assertMentorOnProject, getMentorContext } from "./context";

export interface EvaluationSheetStudent {
  student_id: number;
  usn: string;
  full_name: string;
  member_role: "Leader" | "Member";
  marks_awarded: number | string | null;
  remarks: string | null;
}

export interface EvaluationSheet {
  project_id: number;
  project_title: string;
  milestone_id: number;
  milestone_title: string;
  max_marks: number;
  weightage: number;
  evaluation_id: number | null;
  comments: string | null;
  evaluated_at: string | Date | null;
  students: EvaluationSheetStudent[];
}

export interface StudentMilestoneMark {
  project_id: number;
  student_id: number;
  usn: string;
  student_name: string;
  milestone_id: number;
  milestone_order: number;
  milestone_title: string;
  max_marks: number | string;
  weightage: number | string;
  evaluator_count: number;
  avg_marks: number | string;
  weighted_marks: number | string;
}

export interface FinalResultRow {
  project_id: number;
  project_title: string;
  group_name: string;
  student_id: number;
  usn: string;
  student_name: string;
  weighted_total: number | string;
  grade: string;
  milestones_evaluated: number;
  calculated_at: string | Date;
}

export const saveEvaluationSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  milestone_id: z.coerce.number().int().positive(),
  comments: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  marks: z
    .array(
      z.object({
        student_id: z.coerce.number().int().positive(),
        marks_awarded: z.coerce.number().min(0, "Marks cannot be negative."),
        remarks: z
          .string()
          .trim()
          .max(500)
          .optional()
          .nullable()
          .transform((v) => (v ? v : null)),
      })
    )
    .min(1, "Enter marks for at least one student."),
});
export type SaveEvaluationInput = z.infer<typeof saveEvaluationSchema>;

export async function getEvaluationSheet(
  mentorUserId: number,
  projectId: number,
  milestoneId: number
): Promise<EvaluationSheet> {
  const mentor = await getMentorContext(mentorUserId);
  await assertMentorOnProject(mentor.mentor_id, projectId);

  const [head] = await query<Array<Omit<EvaluationSheet, "students">>>(
    `SELECT cp.project_id, cp.project_title, m.milestone_id, m.title AS milestone_title,
            m.max_marks, m.weightage, e.evaluation_id, e.comments, e.evaluated_at
       FROM capstone_projects cp
       JOIN project_groups pg ON pg.group_id = cp.group_id
       JOIN milestones m      ON m.milestone_id = ? AND m.academic_year = pg.academic_year
       LEFT JOIN evaluations e
              ON e.project_id = cp.project_id AND e.milestone_id = m.milestone_id AND e.evaluator_id = ?
      WHERE cp.project_id = ?`,
    [milestoneId, mentor.mentor_id, projectId]
  );
  if (!head) throw new ServiceError("Milestone not found for this project's academic year.", 404);

  const students = await query<EvaluationSheetStudent[]>(
    `SELECT s.student_id, s.usn, u.full_name, gm.member_role, se.marks_awarded, se.remarks
       FROM capstone_projects cp
       JOIN group_members gm ON gm.group_id = cp.group_id AND gm.membership_status = 'Active'
       JOIN students s       ON s.student_id = gm.student_id
       JOIN users u          ON u.user_id = s.user_id
       LEFT JOIN student_evaluations se
              ON se.student_id = s.student_id AND se.evaluation_id = ?
      WHERE cp.project_id = ?
      ORDER BY (gm.member_role = 'Leader') DESC, s.usn`,
    [head.evaluation_id ?? 0, projectId]
  );

  return {
    ...head,
    max_marks: Number(head.max_marks),
    weightage: Number(head.weightage),
    students,
  };
}

/**
 * Saves (insert or update) this mentor's evaluation and every student's marks
 * in one transaction, then recalculates final marks with sp_calculate_final_marks.
 * Mark limits and group membership are enforced by triggers.
 */
export async function saveEvaluation(mentorUserId: number, input: SaveEvaluationInput): Promise<number> {
  const mentor = await getMentorContext(mentorUserId);
  await assertMentorOnProject(mentor.mentor_id, input.project_id);

  const evaluationId = await withTransaction(async (conn) => {
    const [res] = await conn.execute(
      `INSERT INTO evaluations (project_id, milestone_id, evaluator_id, comments)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE comments = VALUES(comments),
                               evaluation_id = LAST_INSERT_ID(evaluation_id)`,
      [input.project_id, input.milestone_id, mentor.mentor_id, input.comments]
    );
    const id = (res as { insertId: number }).insertId;

    for (const mark of input.marks) {
      await conn.execute(
        `INSERT INTO student_evaluations (evaluation_id, student_id, marks_awarded, remarks)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE marks_awarded = VALUES(marks_awarded), remarks = VALUES(remarks)`,
        [id, mark.student_id, mark.marks_awarded, mark.remarks]
      );
    }
    return id;
  });

  await recalculateFinalMarks(input.project_id);
  await recordActivity({
    projectId: input.project_id,
    actorId: mentorUserId,
    actorRole: "mentor",
    action: "EVALUATION_RECORDED",
    description: `${mentor.full_name} recorded marks for milestone #${input.milestone_id}.`,
    metadata: { evaluationId, milestoneId: input.milestone_id },
  });
  return evaluationId;
}

/** Runs sp_calculate_final_marks and returns the refreshed rows. */
export async function recalculateFinalMarks(projectId: number): Promise<FinalResultRow[]> {
  return withConnection(async (conn) => {
    const [result] = await conn.query("CALL sp_calculate_final_marks(?)", [projectId]);
    // CALL returns [resultSet, okPacket]
    const sets = result as unknown as RowDataPacket[][];
    return (Array.isArray(sets[0]) ? sets[0] : []) as FinalResultRow[];
  });
}

export async function listProjectMarks(projectId: number): Promise<StudentMilestoneMark[]> {
  return query<StudentMilestoneMark[]>(
    `SELECT * FROM v_student_milestone_marks WHERE project_id = ? ORDER BY milestone_order, usn`,
    [projectId]
  );
}

export async function listFinalResults(projectId?: number): Promise<FinalResultRow[]> {
  return projectId
    ? query<FinalResultRow[]>("SELECT * FROM v_final_results WHERE project_id = ? ORDER BY usn", [projectId])
    : query<FinalResultRow[]>("SELECT * FROM v_final_results ORDER BY project_title, usn");
}

export async function listProjectEvaluations(projectId: number) {
  return query<
    Array<{
      evaluation_id: number;
      evaluator_id: number;
      milestone_id: number;
      milestone_title: string;
      milestone_order: number;
      evaluator_name: string;
      comments: string | null;
      evaluated_at: string | Date;
    }>
  >(
    `SELECT e.evaluation_id, e.evaluator_id, e.milestone_id, m.title AS milestone_title, m.milestone_order,
            u.full_name AS evaluator_name, e.comments, e.evaluated_at
       FROM evaluations e
       JOIN milestones m ON m.milestone_id = e.milestone_id
       JOIN capstone_mentors cm ON cm.mentor_id = e.evaluator_id
       JOIN users u ON u.user_id = cm.user_id
      WHERE e.project_id = ?
      ORDER BY m.milestone_order, u.full_name`,
    [projectId]
  );
}
