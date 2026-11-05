import { z } from "zod";
import { query, withConnection } from "@/lib/mysql";
import { ServiceError } from "@/lib/http";
import { getStudentContext } from "./context";

export const PROPOSAL_STATUSES = ["Submitted", "Under Review", "Approved", "Rejected"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export interface ProposalRecord {
  proposal_id: number;
  group_id: number;
  group_name: string;
  academic_year: string;
  version_no: number;
  title: string;
  abstract: string;
  objectives: string | null;
  methodology: string | null;
  technology_stack: string | null;
  project_domain: string | null;
  proposal_status: ProposalStatus;
  submitted_at: string | Date;
  submitted_by_name: string;
  submitted_by_usn: string;
  reviewed_by_name: string | null;
  reviewed_at: string | Date | null;
  review_comments: string | null;
  member_count: number;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const submitProposalSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters.").max(200),
  abstract: z.string().trim().min(30, "Abstract must be at least 30 characters.").max(5000),
  objectives: optionalText(3000),
  methodology: optionalText(3000),
  technology_stack: optionalText(255),
  project_domain: optionalText(80),
});
export type SubmitProposalInput = z.infer<typeof submitProposalSchema>;

export const reviewProposalSchema = z.object({
  decision: z.enum(["Under Review", "Approved", "Rejected"]),
  comments: optionalText(1000),
});
export type ReviewProposalInput = z.infer<typeof reviewProposalSchema>;

const BASE_SELECT = `
  SELECT p.proposal_id, p.group_id, pg.group_name, pg.academic_year, p.version_no, p.title,
         p.abstract, p.objectives, p.methodology, p.technology_stack, p.project_domain,
         p.proposal_status, p.submitted_at,
         su.full_name AS submitted_by_name, s.usn AS submitted_by_usn,
         ru.full_name AS reviewed_by_name, p.reviewed_at, p.review_comments,
         (SELECT COUNT(*) FROM group_members gm
           WHERE gm.group_id = p.group_id AND gm.membership_status = 'Active') AS member_count
    FROM proposals p
    JOIN project_groups pg ON pg.group_id = p.group_id
    JOIN students s        ON s.student_id = p.submitted_by
    JOIN users su          ON su.user_id = s.user_id
    LEFT JOIN users ru     ON ru.user_id = p.reviewed_by
`;

export async function listProposals(status?: ProposalStatus | "Pending"): Promise<ProposalRecord[]> {
  if (status === "Pending") {
    return query<ProposalRecord[]>(
      `${BASE_SELECT} WHERE p.proposal_status IN ('Submitted', 'Under Review') ORDER BY p.submitted_at ASC`
    );
  }
  if (status) {
    return query<ProposalRecord[]>(`${BASE_SELECT} WHERE p.proposal_status = ? ORDER BY p.submitted_at DESC`, [
      status,
    ]);
  }
  return query<ProposalRecord[]>(
    `${BASE_SELECT} ORDER BY (p.proposal_status IN ('Submitted','Under Review')) DESC, p.submitted_at DESC`
  );
}

export async function listGroupProposals(groupId: number): Promise<ProposalRecord[]> {
  return query<ProposalRecord[]>(`${BASE_SELECT} WHERE p.group_id = ? ORDER BY p.version_no DESC`, [groupId]);
}

export async function getProposalStats(): Promise<Record<ProposalStatus, number>> {
  const rows = await query<Array<{ proposal_status: ProposalStatus; n: number }>>(
    "SELECT proposal_status, COUNT(*) AS n FROM proposals GROUP BY proposal_status"
  );
  const stats: Record<ProposalStatus, number> = { Submitted: 0, "Under Review": 0, Approved: 0, Rejected: 0 };
  for (const r of rows) stats[r.proposal_status] = Number(r.n);
  return stats;
}

/** Student submits a proposal for their active group (rules enforced by trg_proposals_before_insert). */
export async function submitProposal(userId: number, input: SubmitProposalInput): Promise<number> {
  const ctx = await getStudentContext(userId);
  if (!ctx.group_id) {
    throw new ServiceError("You must be in an active capstone group before submitting a proposal.");
  }
  const result = await query<{ insertId: number }>(
    `INSERT INTO proposals (group_id, submitted_by, title, abstract, objectives, methodology,
                            technology_stack, project_domain)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx.group_id,
      ctx.student_id,
      input.title,
      input.abstract,
      input.objectives,
      input.methodology,
      input.technology_stack,
      input.project_domain,
    ]
  );
  return result.insertId;
}

/** Coordinator / admin decision, delegated to the stored procedure sp_review_proposal. */
export async function reviewProposal(
  proposalId: number,
  reviewerUserId: number,
  input: ReviewProposalInput
): Promise<{ project_id: number | null }> {
  return withConnection(async (conn) => {
    await conn.query("CALL sp_review_proposal(?, ?, ?, ?)", [
      proposalId,
      reviewerUserId,
      input.decision,
      input.comments,
    ]);
    const [rows] = await conn.query(
      `SELECT cp.project_id FROM proposals p
         LEFT JOIN capstone_projects cp ON cp.group_id = p.group_id
        WHERE p.proposal_id = ?`,
      [proposalId]
    );
    const row = (rows as Array<{ project_id: number | null }>)[0];
    return { project_id: row?.project_id ?? null };
  });
}
