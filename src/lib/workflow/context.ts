import { query } from "@/lib/mysql";
import { ServiceError } from "@/lib/http";

/**
 * Resolves the logged-in user to their student / mentor record and the
 * student's active group + project. Used by every workflow service so that
 * IDs coming from the browser are never trusted for ownership.
 */

export interface StudentContext {
  student_id: number;
  user_id: number;
  usn: string;
  full_name: string;
  email: string;
  department: string;
  batch: string;
  group_id: number | null;
  group_name: string | null;
  academic_year: string | null;
  member_role: "Leader" | "Member" | null;
  project_id: number | null;
  project_title: string | null;
  project_status: string | null;
}

export async function getStudentContext(userId: number): Promise<StudentContext> {
  const rows = await query<StudentContext[]>(
    `SELECT s.student_id, s.user_id, s.usn, u.full_name, u.email, s.department, s.batch,
            pg.group_id, pg.group_name, pg.academic_year, gm.member_role,
            cp.project_id, cp.project_title, cp.project_status
       FROM students s
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN group_members gm
              ON gm.student_id = s.student_id AND gm.membership_status = 'Active'
       LEFT JOIN project_groups pg
              ON pg.group_id = gm.group_id AND pg.group_status <> 'Disbanded'
       LEFT JOIN capstone_projects cp ON cp.group_id = pg.group_id
      WHERE s.user_id = ?
      ORDER BY pg.group_id IS NULL, gm.joined_at DESC
      LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) {
    throw new ServiceError("No student profile is linked to this account.", 404);
  }
  return rows[0];
}

export interface MentorContext {
  mentor_id: number;
  user_id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  designation: string | null;
  max_projects: number;
  availability_status: string;
}

export async function getMentorContext(userId: number): Promise<MentorContext> {
  const rows = await query<MentorContext[]>(
    `SELECT m.mentor_id, m.user_id, m.employee_id, u.full_name, u.email, m.department,
            m.designation, m.max_projects, m.availability_status
       FROM capstone_mentors m
       JOIN users u ON u.user_id = m.user_id
      WHERE m.user_id = ?
      LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) {
    throw new ServiceError("No faculty profile is linked to this account.", 404);
  }
  return rows[0];
}

/** Throws unless the mentor is actively allocated to the project. */
export async function assertMentorOnProject(mentorId: number, projectId: number): Promise<void> {
  const rows = await query<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM mentor_allocations
      WHERE mentor_id = ? AND project_id = ? AND allocation_status = 'Active'`,
    [mentorId, projectId]
  );
  if (Number(rows[0]?.n || 0) === 0) {
    throw new ServiceError("You are not an allocated guide for this project.", 403);
  }
}
