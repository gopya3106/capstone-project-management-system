import { query, withTransaction, withConnection } from "@/lib/mysql";
import {
  MentorListItem,
  MentorDetails,
  MentorFilterParams,
  MentorStats,
  AssignMentorInput,
  UpdateMentorInput,
  MentorAssignedProject,
  MentorAllocationRecord,
} from "./types";
import { RowDataPacket } from "mysql2";

/**
 * Retrieves aggregate statistics for capstone mentors and allocations.
 */
export async function getMentorStats(): Promise<MentorStats> {
  const mentorCountsSql = `
    SELECT
      COUNT(*) AS totalMentors,
      SUM(CASE WHEN availability_status = 'Available' THEN 1 ELSE 0 END) AS availableMentors,
      SUM(CASE WHEN availability_status = 'Unavailable' THEN 1 ELSE 0 END) AS unavailableMentors
    FROM capstone_mentors
  `;
  const [mentorCounts] = await query<
    Array<{
      totalMentors: number;
      availableMentors: number;
      unavailableMentors: number;
    }>
  >(mentorCountsSql);

  const allocCountsSql = `
    SELECT
      COUNT(*) AS activeAllocationsCount,
      SUM(CASE WHEN mentor_role = 'Primary' THEN 1 ELSE 0 END) AS primaryAllocationsCount,
      SUM(CASE WHEN mentor_role = 'Co-Mentor' THEN 1 ELSE 0 END) AS coMentorAllocationsCount
    FROM mentor_allocations
    WHERE allocation_status = 'Active'
  `;
  const [allocCounts] = await query<
    Array<{
      activeAllocationsCount: number;
      primaryAllocationsCount: number;
      coMentorAllocationsCount: number;
    }>
  >(allocCountsSql);

  const totalMentors = Number(mentorCounts?.totalMentors || 0);
  const activeAllocations = Number(allocCounts?.activeAllocationsCount || 0);
  const avgWorkload = totalMentors > 0 ? parseFloat((activeAllocations / totalMentors).toFixed(2)) : 0;

  return {
    totalMentors,
    availableMentors: Number(mentorCounts?.availableMentors || 0),
    unavailableMentors: Number(mentorCounts?.unavailableMentors || 0),
    activeAllocationsCount: activeAllocations,
    primaryAllocationsCount: Number(allocCounts?.primaryAllocationsCount || 0),
    coMentorAllocationsCount: Number(allocCounts?.coMentorAllocationsCount || 0),
    avgWorkload,
  };
}

/**
 * Queries mentors with workload calculation and optional filtering.
 */
export async function getMentors(
  filters: MentorFilterParams = {}
): Promise<{ mentors: MentorListItem[]; total: number }> {
  const conditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (filters.search) {
    conditions.push(
      "(u.full_name LIKE ? OR u.email LIKE ? OR m.employee_id LIKE ? OR m.specialization LIKE ?)"
    );
    const searchPattern = `%${filters.search.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (filters.department) {
    conditions.push("m.department = ?");
    params.push(filters.department.trim());
  }

  if (filters.specialization) {
    conditions.push("m.specialization LIKE ?");
    params.push(`%${filters.specialization.trim()}%`);
  }

  if (filters.availability) {
    conditions.push("m.availability_status = ?");
    params.push(filters.availability);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      m.mentor_id,
      m.user_id,
      m.employee_id,
      u.full_name,
      u.email,
      u.phone_number,
      m.department,
      m.designation,
      m.specialization,
      m.years_of_experience,
      m.max_projects,
      m.availability_status,
      m.office_location,
      COALESCE(active_sub.active_count, 0) AS active_projects_count,
      COALESCE(ended_sub.ended_count, 0) AS completed_projects_count
    FROM capstone_mentors m
    JOIN users u ON m.user_id = u.user_id
    LEFT JOIN (
      SELECT mentor_id, COUNT(*) AS active_count
      FROM mentor_allocations
      WHERE allocation_status = 'Active'
      GROUP BY mentor_id
    ) active_sub ON m.mentor_id = active_sub.mentor_id
    LEFT JOIN (
      SELECT mentor_id, COUNT(*) AS ended_count
      FROM mentor_allocations
      WHERE allocation_status = 'Ended'
      GROUP BY mentor_id
    ) ended_sub ON m.mentor_id = ended_sub.mentor_id
    ${whereClause}
    ORDER BY u.full_name ASC
  `;

  const rows = await query<Array<RowDataPacket & MentorListItem>>(sql, params);

  // If capacity filter is requested, filter in memory or via SQL having
  let filteredMentors = rows.map((r) => ({
    ...r,
    active_projects_count: Number(r.active_projects_count),
    completed_projects_count: Number(r.completed_projects_count),
    assigned_projects: [] as MentorAssignedProject[],
  }));

  if (filters.hasCapacity !== undefined) {
    if (filters.hasCapacity) {
      filteredMentors = filteredMentors.filter(
        (m) => m.availability_status === "Available" && m.active_projects_count < m.max_projects
      );
    } else {
      filteredMentors = filteredMentors.filter(
        (m) => m.availability_status === "Unavailable" || m.active_projects_count >= m.max_projects
      );
    }
  }

  // Populate active assigned projects for each mentor
  if (filteredMentors.length > 0) {
    const mentorIds = filteredMentors.map((m) => m.mentor_id);
    const placeholders = mentorIds.map(() => "?").join(", ");
    const projectsSql = `
      SELECT
        ma.mentor_id,
        ma.project_id,
        cp.project_title,
        cp.project_status,
        pg.group_name,
        ma.mentor_role,
        ma.allocation_status,
        ma.allocation_date
      FROM mentor_allocations ma
      JOIN capstone_projects cp ON ma.project_id = cp.project_id
      JOIN project_groups pg ON cp.group_id = pg.group_id
      WHERE ma.mentor_id IN (${placeholders}) AND ma.allocation_status = 'Active'
      ORDER BY ma.allocation_date DESC
    `;
    const assignedRows = await query<
      Array<{
        mentor_id: number;
        project_id: number;
        project_title: string;
        project_status: string;
        group_name: string;
        mentor_role: "Primary" | "Co-Mentor";
        allocation_status: "Active" | "Ended";
        allocation_date: string | Date;
      }>
    >(projectsSql, mentorIds);

    const projectMap = new Map<number, MentorAssignedProject[]>();
    for (const proj of assignedRows) {
      const list = projectMap.get(proj.mentor_id) || [];
      list.push({
        project_id: proj.project_id,
        project_title: proj.project_title,
        project_status: proj.project_status,
        group_name: proj.group_name,
        mentor_role: proj.mentor_role,
        allocation_status: proj.allocation_status,
        allocation_date: proj.allocation_date,
      });
      projectMap.set(proj.mentor_id, list);
    }

    filteredMentors.forEach((m) => {
      m.assigned_projects = projectMap.get(m.mentor_id) || [];
    });
  }

  return {
    mentors: filteredMentors,
    total: filteredMentors.length,
  };
}

/**
 * Retrieves full details for a mentor, including complete allocation history.
 */
export async function getMentorById(mentorId: number): Promise<MentorDetails | null> {
  const mentorSql = `
    SELECT
      m.mentor_id,
      m.user_id,
      m.employee_id,
      u.full_name,
      u.email,
      u.phone_number,
      m.department,
      m.designation,
      m.specialization,
      m.years_of_experience,
      m.max_projects,
      m.availability_status,
      m.office_location,
      COALESCE(active_sub.active_count, 0) AS active_projects_count,
      COALESCE(ended_sub.ended_count, 0) AS completed_projects_count
    FROM capstone_mentors m
    JOIN users u ON m.user_id = u.user_id
    LEFT JOIN (
      SELECT mentor_id, COUNT(*) AS active_count
      FROM mentor_allocations
      WHERE allocation_status = 'Active'
      GROUP BY mentor_id
    ) active_sub ON m.mentor_id = active_sub.mentor_id
    LEFT JOIN (
      SELECT mentor_id, COUNT(*) AS ended_count
      FROM mentor_allocations
      WHERE allocation_status = 'Ended'
      GROUP BY mentor_id
    ) ended_sub ON m.mentor_id = ended_sub.mentor_id
    WHERE m.mentor_id = ?
  `;

  const [mentor] = await query<Array<RowDataPacket & MentorListItem>>(mentorSql, [mentorId]);
  if (!mentor) {
    return null;
  }

  const allocSql = `
    SELECT
      ma.allocation_id,
      ma.project_id,
      cp.project_title,
      cp.project_status,
      pg.group_id,
      pg.group_name,
      pg.department,
      pg.academic_year,
      COALESCE(ldr_u.full_name, 'Unknown') AS team_leader_name,
      COALESCE(ldr_s.usn, '') AS team_leader_usn,
      ma.mentor_role,
      ma.allocation_status,
      ma.allocation_date,
      ma.end_date,
      ma.remarks,
      ma.allocated_by,
      alloc_u.full_name AS allocated_by_name
    FROM mentor_allocations ma
    JOIN capstone_projects cp ON ma.project_id = cp.project_id
    JOIN project_groups pg ON cp.group_id = pg.group_id
    LEFT JOIN students ldr_s ON pg.team_leader_id = ldr_s.student_id
    LEFT JOIN users ldr_u ON ldr_s.user_id = ldr_u.user_id
    LEFT JOIN users alloc_u ON ma.allocated_by = alloc_u.user_id
    WHERE ma.mentor_id = ?
    ORDER BY (ma.allocation_status = 'Active') DESC, ma.allocation_date DESC
  `;

  const allocations = await query<Array<RowDataPacket & MentorAllocationRecord>>(allocSql, [
    mentorId,
  ]);

  return {
    ...mentor,
    active_projects_count: Number(mentor.active_projects_count),
    completed_projects_count: Number(mentor.completed_projects_count),
    assigned_projects: allocations
      .filter((a) => a.allocation_status === "Active")
      .map((a) => ({
        project_id: a.project_id,
        project_title: a.project_title,
        project_status: a.project_status,
        group_name: a.group_name,
        mentor_role: a.mentor_role,
        allocation_status: a.allocation_status,
        allocation_date: a.allocation_date,
      })),
    allocations,
  };
}

/**
 * Returns mentors who have capacity and are available to be assigned to a project.
 */
export async function getAvailableMentorsForProject(
  projectId?: number
): Promise<Array<MentorListItem & { is_already_assigned: boolean }>> {
  const { mentors } = await getMentors();

  let assignedMentorIds = new Set<number>();
  if (projectId) {
    const existingAllocations = await query<Array<{ mentor_id: number }>>(
      `SELECT mentor_id FROM mentor_allocations WHERE project_id = ? AND allocation_status = 'Active'`,
      [projectId]
    );
    assignedMentorIds = new Set(existingAllocations.map((a) => a.mentor_id));
  }

  return mentors.map((m) => ({
    ...m,
    is_already_assigned: assignedMentorIds.has(m.mentor_id),
  }));
}

/**
 * Assigns a mentor to a capstone project via the stored procedure sp_allocate_guide.
 *
 * Enforces:
 * 1. Project exists.
 * 2. Mentor exists, is 'Available', and has not exceeded max_projects.
 * 3. Mentor is not already actively allocated to this project.
 * 4. If assigning as Primary mentor, any previous active Primary mentor is atomically Ended.
 * 5. Handles unique constraint uq_project_mentor (reactivates if previously ended, or inserts).
 */
export async function assignMentorToProject(
  input: AssignMentorInput,
  allocatedByUserId: number
): Promise<{ success: boolean; allocation_id: number; message: string }> {
  // All rules (availability, capacity, duplicate, Primary hand-over) live in
  // the stored procedure sp_allocate_guide, which runs its own transaction.
  return withConnection(async (conn) => {
    try {
      await conn.query("CALL sp_allocate_guide(?, ?, ?, ?, ?, @cpms_allocation_id)", [
        input.project_id,
        input.mentor_id,
        input.mentor_role,
        allocatedByUserId,
        input.remarks || null,
      ]);
      const [rows] = await conn.query<RowDataPacket[]>("SELECT @cpms_allocation_id AS allocation_id");
      return {
        success: true,
        allocation_id: Number(rows[0]?.allocation_id),
        message: `Mentor successfully assigned as ${input.mentor_role}.`,
      };
    } catch (error: unknown) {
      const sqlMessage = (error as { sqlMessage?: string }).sqlMessage;
      throw new Error(sqlMessage || (error instanceof Error ? error.message : "Allocation failed."));
    }
  });
}

/**
 * Ends an active mentor allocation.
 */
export async function endMentorAllocation(
  allocationId: number,
  remarks?: string | null
): Promise<{ success: boolean; message: string }> {
  return await withTransaction(async (conn) => {
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT allocation_id, allocation_status, mentor_role FROM mentor_allocations WHERE allocation_id = ? FOR UPDATE`,
      [allocationId]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`Allocation with ID ${allocationId} not found.`);
    }

    if (rows[0].allocation_status === "Ended") {
      throw new Error("This allocation has already ended.");
    }

    const appendRemark = remarks ? ` [Ended: ${remarks}]` : " [Allocation Ended]";
    await conn.execute(
      `UPDATE mentor_allocations
       SET allocation_status = 'Ended',
           end_date = CURDATE(),
           remarks = CONCAT(COALESCE(remarks, ''), ?)
       WHERE allocation_id = ?`,
      [appendRemark, allocationId]
    );

    return {
      success: true,
      message: `${rows[0].mentor_role} allocation successfully ended.`,
    };
  });
}

/**
 * Updates a mentor's profile (availability, max_projects, designation, etc.).
 */
export async function updateMentor(
  mentorId: number,
  input: UpdateMentorInput
): Promise<void> {
  const updates: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (input.max_projects !== undefined) {
    updates.push("max_projects = ?");
    params.push(input.max_projects);
  }
  if (input.availability_status !== undefined) {
    updates.push("availability_status = ?");
    params.push(input.availability_status);
  }
  if (input.designation !== undefined) {
    updates.push("designation = ?");
    params.push(input.designation ? input.designation.trim() : null);
  }
  if (input.specialization !== undefined) {
    updates.push("specialization = ?");
    params.push(input.specialization ? input.specialization.trim() : null);
  }
  if (input.office_location !== undefined) {
    updates.push("office_location = ?");
    params.push(input.office_location ? input.office_location.trim() : null);
  }
  if (input.years_of_experience !== undefined) {
    updates.push("years_of_experience = ?");
    params.push(input.years_of_experience);
  }

  if (updates.length > 0) {
    params.push(mentorId);
    await query(`UPDATE capstone_mentors SET ${updates.join(", ")} WHERE mentor_id = ?`, params);
  }
}

