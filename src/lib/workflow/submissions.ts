import { z } from "zod";
import { query } from "@/lib/mysql";
import { ServiceError } from "@/lib/http";
import { recordActivity, recordFeedback, recordSubmissionVersion } from "@/lib/activity";
import { assertMentorOnProject, getMentorContext, getStudentContext } from "./context";

export const SUBMISSION_STATUSES = ["Submitted", "Under Review", "Accepted", "Revision Requested"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface SubmissionRecord {
  submission_id: number;
  project_id: number;
  project_title: string;
  group_name: string;
  milestone_id: number;
  milestone_order: number;
  milestone_title: string;
  due_date: string | Date;
  version_no: number;
  document_title: string;
  document_url: string;
  notes: string | null;
  submitted_at: string | Date;
  is_late: number;
  submission_status: SubmissionStatus;
  submitted_by_name: string;
  reviewed_by_name: string | null;
  reviewed_at: string | Date | null;
  feedback: string | null;
}

const BASE_SELECT = `
  SELECT s.submission_id, s.project_id, cp.project_title, pg.group_name,
         s.milestone_id, m.milestone_order, m.title AS milestone_title, m.due_date,
         s.version_no, s.document_title, s.document_url, s.notes, s.submitted_at, s.is_late,
         s.submission_status, su.full_name AS submitted_by_name,
         ru.full_name AS reviewed_by_name, s.reviewed_at, s.feedback
    FROM submissions s
    JOIN capstone_projects cp ON cp.project_id = s.project_id
    JOIN project_groups pg    ON pg.group_id   = cp.group_id
    JOIN milestones m         ON m.milestone_id = s.milestone_id
    JOIN students st          ON st.student_id = s.submitted_by
    JOIN users su             ON su.user_id = st.user_id
    LEFT JOIN capstone_mentors rm ON rm.mentor_id = s.reviewed_by
    LEFT JOIN users ru            ON ru.user_id = rm.user_id
`;

export const submitDocumentSchema = z.object({
  milestone_id: z.coerce.number().int().positive(),
  document_title: z.string().trim().min(3).max(200),
  document_url: z
    .string()
    .trim()
    .url("Enter a full link starting with https://")
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), "Link must start with http:// or https://"),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});
export type SubmitDocumentInput = z.infer<typeof submitDocumentSchema>;

export const reviewSubmissionSchema = z.object({
  submission_status: z.enum(["Under Review", "Accepted", "Revision Requested"]),
  feedback: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;

export async function listProjectSubmissions(projectId: number): Promise<SubmissionRecord[]> {
  return query<SubmissionRecord[]>(
    `${BASE_SELECT} WHERE s.project_id = ? ORDER BY m.milestone_order ASC, s.version_no DESC`,
    [projectId]
  );
}

export interface SubmissionFilters {
  status?: SubmissionStatus;
  lateOnly?: boolean;
  milestoneId?: number;
}

export async function listSubmissions(filters: SubmissionFilters = {}): Promise<SubmissionRecord[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.status) {
    where.push("s.submission_status = ?");
    params.push(filters.status);
  }
  if (filters.lateOnly) where.push("s.is_late = 1");
  if (filters.milestoneId) {
    where.push("s.milestone_id = ?");
    params.push(filters.milestoneId);
  }
  return query<SubmissionRecord[]>(
    `${BASE_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY s.submitted_at DESC LIMIT 200`,
    params
  );
}

/** Student uploads (links) a document for a milestone. Versioning + late flag come from the trigger. */
export async function submitDocument(userId: number, input: SubmitDocumentInput): Promise<SubmissionRecord> {
  const ctx = await getStudentContext(userId);
  if (!ctx.project_id) {
    throw new ServiceError("Your group does not have an approved project yet.");
  }
  const result = await query<{ insertId: number }>(
    `INSERT INTO submissions (project_id, milestone_id, submitted_by, document_title, document_url, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ctx.project_id, input.milestone_id, ctx.student_id, input.document_title, input.document_url, input.notes]
  );
  const [saved] = await query<SubmissionRecord[]>(`${BASE_SELECT} WHERE s.submission_id = ?`, [result.insertId]);

  await Promise.all([
    recordSubmissionVersion({
      submissionId: saved.submission_id,
      projectId: saved.project_id,
      studentId: ctx.student_id,
      versionNumber: saved.version_no,
      fileName: saved.document_title,
      fileSizeBytes: 0,
      mimeType: "text/uri-list",
      storagePath: saved.document_url,
      changeNotes: saved.notes || undefined,
      metadata: { milestoneId: saved.milestone_id, isLate: Boolean(saved.is_late) },
    }),
    recordActivity({
      projectId: saved.project_id,
      actorId: userId,
      actorRole: "student",
      action: "SUBMISSION_UPLOADED",
      description: `${ctx.full_name} submitted "${saved.document_title}" (v${saved.version_no}) for ${saved.milestone_title}${saved.is_late ? " after the due date" : ""}.`,
      metadata: { submissionId: saved.submission_id, milestoneId: saved.milestone_id },
    }),
  ]);
  return saved;
}

/** Guide reviews a submission; only an allocated mentor may do this. */
export async function reviewSubmission(
  mentorUserId: number,
  submissionId: number,
  input: ReviewSubmissionInput
): Promise<void> {
  const mentor = await getMentorContext(mentorUserId);
  const [sub] = await query<SubmissionRecord[]>(`${BASE_SELECT} WHERE s.submission_id = ?`, [submissionId]);
  if (!sub) throw new ServiceError("Submission not found.", 404);
  await assertMentorOnProject(mentor.mentor_id, sub.project_id);

  if (input.submission_status === "Revision Requested" && !input.feedback) {
    throw new ServiceError("Please explain what needs to be revised.");
  }

  await query(
    `UPDATE submissions
        SET submission_status = ?, feedback = COALESCE(?, feedback),
            reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE submission_id = ?`,
    [input.submission_status, input.feedback, mentor.mentor_id, submissionId]
  );

  await Promise.all([
    input.feedback
      ? recordFeedback({
          projectId: sub.project_id,
          mentorId: mentor.mentor_id,
          submissionId,
          milestoneTitle: sub.milestone_title,
          feedbackType:
            input.submission_status === "Accepted"
              ? "approval"
              : input.submission_status === "Revision Requested"
                ? "revision_required"
                : "general",
          comments: input.feedback,
        })
      : Promise.resolve(),
    recordActivity({
      projectId: sub.project_id,
      actorId: mentorUserId,
      actorRole: "mentor",
      action: "SUBMISSION_REVIEWED",
      description: `${mentor.full_name} marked "${sub.document_title}" (v${sub.version_no}) as ${input.submission_status}.`,
      metadata: { submissionId },
    }),
  ]);
}
