import { query, withTransaction } from "@/lib/mysql";
import {
  GroupListItem,
  GroupDetails,
  GroupFilterParams,
  GroupStats,
  CreateGroupInput,
  GroupMemberDetail,
  GroupCapstoneProject,
  MemberRole,
} from "./types";

/**
 * Retrieves aggregate metrics across all capstone project groups.
 */
export async function getGroupStats(): Promise<GroupStats> {
  const sql = `
    SELECT
      COUNT(*) AS totalGroups,
      SUM(CASE WHEN group_status = 'Active' THEN 1 ELSE 0 END) AS activeGroups,
      SUM(CASE WHEN group_status = 'Forming' THEN 1 ELSE 0 END) AS formingGroups,
      SUM(CASE WHEN group_status = 'Completed' THEN 1 ELSE 0 END) AS completedGroups,
      AVG(team_size) AS averageTeamSize
    FROM project_groups
  `;
  const [row] = await query<Array<{
    totalGroups: number;
    activeGroups: number;
    formingGroups: number;
    completedGroups: number;
    averageTeamSize: number;
  }>>(sql);

  return {
    totalGroups: Number(row?.totalGroups || 0),
    activeGroups: Number(row?.activeGroups || 0),
    formingGroups: Number(row?.formingGroups || 0),
    completedGroups: Number(row?.completedGroups || 0),
    averageTeamSize: Number(Number(row?.averageTeamSize || 0).toFixed(1)),
  };
}

/**
 * Queries a filtered list of capstone groups with leader details and active member counts.
 */
export async function getGroups(
  filters: GroupFilterParams = {}
): Promise<{ groups: GroupListItem[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    conditions.push(
      "(pg.group_name LIKE ? OR u_ldr.full_name LIKE ? OR s_ldr.usn LIKE ? OR cp.project_title LIKE ?)"
    );
    const searchPattern = `%${filters.search.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (filters.department) {
    conditions.push("pg.department = ?");
    params.push(filters.department.trim());
  }

  if (filters.batch) {
    conditions.push("pg.batch = ?");
    params.push(filters.batch.trim());
  }

  if (filters.academic_year) {
    conditions.push("pg.academic_year = ?");
    params.push(filters.academic_year.trim());
  }

  if (filters.status) {
    conditions.push("pg.group_status = ?");
    params.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count total matching
  const countSql = `
    SELECT COUNT(DISTINCT pg.group_id) AS total
    FROM project_groups pg
    LEFT JOIN students s_ldr ON pg.team_leader_id = s_ldr.student_id
    LEFT JOIN users u_ldr ON s_ldr.user_id = u_ldr.user_id
    LEFT JOIN capstone_projects cp ON pg.group_id = cp.group_id
    ${whereClause}
  `;
  const countRows = await query<Array<{ total: number }>>(countSql, params);
  const total = Number(countRows[0]?.total || 0);

  // Paginated records
  const page = Math.max(1, filters.page || 1);
  const limit = Math.max(1, Math.min(100, filters.limit || 50));
  const offset = (page - 1) * limit;

  const dataSql = `
    SELECT
      pg.group_id,
      pg.group_name,
      pg.batch,
      pg.department,
      pg.academic_year,
      pg.formation_date,
      pg.group_status,
      pg.team_leader_id,
      COALESCE(u_ldr.full_name, 'Unassigned') AS leader_name,
      COALESCE(s_ldr.usn, '') AS leader_usn,
      COALESCE(u_ldr.email, '') AS leader_email,
      pg.team_size,
      COUNT(gm.group_member_id) AS active_member_count,
      cp.project_id,
      cp.project_title,
      cp.project_status
    FROM project_groups pg
    LEFT JOIN students s_ldr ON pg.team_leader_id = s_ldr.student_id
    LEFT JOIN users u_ldr ON s_ldr.user_id = u_ldr.user_id
    LEFT JOIN group_members gm ON pg.group_id = gm.group_id AND gm.membership_status = 'Active'
    LEFT JOIN capstone_projects cp ON pg.group_id = cp.group_id
    ${whereClause}
    GROUP BY pg.group_id, cp.project_id
    ORDER BY pg.formation_date DESC, pg.group_id DESC
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, limit, offset];
  const groups = await query<GroupListItem[]>(dataSql, queryParams);

  return { groups, total };
}

/**
 * Retrieves full details for a single capstone group including active members roster and project info.
 */
export async function getGroupById(groupId: number): Promise<GroupDetails | null> {
  const baseSql = `
    SELECT
      pg.group_id,
      pg.group_name,
      pg.batch,
      pg.department,
      pg.academic_year,
      pg.formation_date,
      pg.group_status,
      pg.team_leader_id,
      COALESCE(u_ldr.full_name, 'Unassigned') AS leader_name,
      COALESCE(s_ldr.usn, '') AS leader_usn,
      COALESCE(u_ldr.email, '') AS leader_email,
      pg.team_size,
      COUNT(gm.group_member_id) AS active_member_count,
      cp.project_id,
      cp.project_title,
      cp.project_status
    FROM project_groups pg
    LEFT JOIN students s_ldr ON pg.team_leader_id = s_ldr.student_id
    LEFT JOIN users u_ldr ON s_ldr.user_id = u_ldr.user_id
    LEFT JOIN group_members gm ON pg.group_id = gm.group_id AND gm.membership_status = 'Active'
    LEFT JOIN capstone_projects cp ON pg.group_id = cp.group_id
    WHERE pg.group_id = ?
    GROUP BY pg.group_id, cp.project_id
    LIMIT 1
  `;

  const rows = await query<GroupListItem[]>(baseSql, [groupId]);
  if (!rows || rows.length === 0) {
    return null;
  }
  const group = rows[0];

  // Load all member records (both active and past)
  const membersSql = `
    SELECT
      gm.group_member_id,
      gm.student_id,
      st.usn,
      usr.full_name,
      usr.email,
      usr.phone_number,
      st.current_semester,
      st.section,
      gm.member_role,
      gm.membership_status,
      gm.joined_at,
      gm.left_at
    FROM group_members gm
    JOIN students st ON gm.student_id = st.student_id
    JOIN users usr ON st.user_id = usr.user_id
    WHERE gm.group_id = ?
    ORDER BY (gm.member_role = 'Leader') DESC, (gm.membership_status = 'Active') DESC, st.usn ASC
  `;
  const members = await query<GroupMemberDetail[]>(membersSql, [groupId]);

  // Load linked Capstone Project details if present
  let capstoneProject: GroupCapstoneProject | null = null;
  const projectSql = `
    SELECT
      project_id,
      group_id,
      project_title,
      project_status,
      project_domain,
      project_type,
      problem_statement,
      objectives,
      technology_stack
    FROM capstone_projects
    WHERE group_id = ?
    LIMIT 1
  `;
  const projectRows = await query<GroupCapstoneProject[]>(projectSql, [groupId]);
  if (projectRows && projectRows.length > 0) {
    capstoneProject = projectRows[0];
  }

  return {
    ...group,
    members: members || [],
    capstone_project: capstoneProject,
  };
}

/**
 * Creates a new capstone project group within a MySQL transaction.
 *
 * Strict Business Rules Enforced:
 * 1. Team size must be between 1 and 4 members.
 * 2. Team leader must be one of the selected group members.
 * 3. None of the students can currently belong to another active, non-disbanded group.
 * 4. Multi-table inserts into `project_groups`, `group_members`, and optionally `capstone_projects`
 *    are executed atomically within a managed transaction.
 */
export async function createGroup(input: CreateGroupInput): Promise<{
  group_id: number;
  group_name: string;
  project_id: number | null;
}> {
  // 1. Validate team size
  if (!input.member_ids || input.member_ids.length < 1 || input.member_ids.length > 4) {
    throw new Error("A group must have between 1 and 4 members.");
  }

  // 2. Validate leader is among members
  if (!input.member_ids.includes(input.team_leader_id)) {
    throw new Error("The designated team leader must be one of the selected group members.");
  }

  return withTransaction(async (conn) => {
    // 3. Check for duplicate group name in the same academic year
    const [existingGroup] = await conn.execute(
      "SELECT group_id FROM project_groups WHERE LOWER(group_name) = LOWER(?) AND academic_year = ? LIMIT 1",
      [input.group_name.trim(), input.academic_year.trim()]
    );
    if (Array.isArray(existingGroup) && existingGroup.length > 0) {
      throw new Error(
        `A capstone group named "${input.group_name}" already exists for academic year ${input.academic_year}.`
      );
    }

    // 4. Verify that all students exist, are Active, and NOT in any active group (lock with FOR UPDATE)
    const placeholders = input.member_ids.map(() => "?").join(",");

    // A: Check valid active students
    const [validStudents] = await conn.query(
      `SELECT student_id, usn FROM students WHERE student_id IN (${placeholders}) AND academic_status = 'Active'`,
      input.member_ids
    );
    if (!Array.isArray(validStudents) || validStudents.length !== input.member_ids.length) {
      throw new Error(
        "One or more selected students do not exist or are not in 'Active' academic status."
      );
    }

    // B: Check active group collision
    const [existingMemberships] = await conn.query(
      `SELECT
         gm.student_id,
         s.usn,
         u.full_name,
         pg.group_name
       FROM group_members gm
       JOIN project_groups pg ON gm.group_id = pg.group_id
       JOIN students s ON gm.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE gm.student_id IN (${placeholders})
         AND gm.membership_status = 'Active'
         AND pg.group_status != 'Disbanded'
       FOR UPDATE`,
      input.member_ids
    );

    if (Array.isArray(existingMemberships) && existingMemberships.length > 0) {
      const conflict = existingMemberships[0] as {
        full_name: string;
        usn: string;
        group_name: string;
      };
      throw new Error(
        `Cannot create group: Student "${conflict.full_name}" (${conflict.usn}) is already an active member of group "${conflict.group_name}". Multiple active memberships are strictly prohibited.`
      );
    }

    // 5. Insert into project_groups
    const [groupResult] = await conn.execute(
      `INSERT INTO project_groups
         (group_name, batch, department, academic_year, formation_date, team_leader_id, team_size, group_status)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?, 'Active')`,
      [
        input.group_name.trim(),
        input.batch.trim(),
        input.department.trim(),
        input.academic_year.trim(),
        input.team_leader_id,
        input.member_ids.length,
      ]
    );
    const groupId = (groupResult as { insertId: number }).insertId;

    // 6. Insert group_members records
    for (const studentId of input.member_ids) {
      const role: MemberRole = studentId === input.team_leader_id ? "Leader" : "Member";
      await conn.execute(
        `INSERT INTO group_members
           (group_id, student_id, member_role, membership_status)
         VALUES (?, ?, ?, 'Active')`,
        [groupId, studentId, role]
      );
    }

    // 7. Optionally initialize linked Capstone Project
    let projectId: number | null = null;
    if (input.project_title && input.project_title.trim().length > 0) {
      const [projectResult] = await conn.execute(
        `INSERT INTO capstone_projects
           (group_id, project_title, project_domain, project_status, start_date)
         VALUES (?, ?, ?, 'Proposed', CURDATE())`,
        [
          groupId,
          input.project_title.trim(),
          input.project_domain?.trim() || null,
        ]
      );
      projectId = (projectResult as { insertId: number }).insertId;
    }

    return {
      group_id: groupId,
      group_name: input.group_name.trim(),
      project_id: projectId,
    };
  });
}

/**
 * Adds an available student to an existing group, ensuring the 4-member limit is respected.
 */
export async function addMemberToGroup(
  groupId: number,
  studentId: number,
  memberRole: MemberRole = "Member"
): Promise<void> {
  return withTransaction(async (conn) => {
    // 1. Check group existence and current active member count
    const [groupRows] = await conn.execute(
      "SELECT group_id, group_status, team_size FROM project_groups WHERE group_id = ? FOR UPDATE",
      [groupId]
    );
    if (!Array.isArray(groupRows) || groupRows.length === 0) {
      throw new Error(`Group #${groupId} not found.`);
    }
    const group = groupRows[0] as { group_status: string; team_size: number };
    if (group.group_status === "Disbanded" || group.group_status === "Completed") {
      throw new Error(`Cannot add members to a ${group.group_status.toLowerCase()} group.`);
    }

    const [activeMembers] = await conn.execute(
      "SELECT COUNT(*) AS activeCount FROM group_members WHERE group_id = ? AND membership_status = 'Active'",
      [groupId]
    );
    const currentCount = Number((activeMembers as Array<{ activeCount: number }>)[0]?.activeCount || 0);
    if (currentCount >= 4) {
      throw new Error("Group already has the maximum allowed team size of 4 active members.");
    }

    // 2. Check student is active and not already in an active group
    const [existingMembership] = await conn.execute(
      `SELECT gm.group_id, pg.group_name
       FROM group_members gm
       JOIN project_groups pg ON gm.group_id = pg.group_id
       WHERE gm.student_id = ?
         AND gm.membership_status = 'Active'
         AND pg.group_status != 'Disbanded'
       LIMIT 1`,
      [studentId]
    );
    if (Array.isArray(existingMembership) && existingMembership.length > 0) {
      const row = existingMembership[0] as { group_name: string };
      throw new Error(`Student is already an active member of group "${row.group_name}".`);
    }

    // 3. Insert into group_members
    await conn.execute(
      `INSERT INTO group_members (group_id, student_id, member_role, membership_status)
       VALUES (?, ?, ?, 'Active')`,
      [groupId, studentId, memberRole]
    );

    // 4. Update team_size in project_groups
    await conn.execute(
      "UPDATE project_groups SET team_size = team_size + 1 WHERE group_id = ?",
      [groupId]
    );
  });
}

/**
 * Removes an active member from a group (marking membership as Inactive).
 */
export async function removeMemberFromGroup(
  groupId: number,
  studentId: number
): Promise<void> {
  return withTransaction(async (conn) => {
    // Check if member is the team leader
    const [groupRows] = await conn.execute(
      "SELECT team_leader_id FROM project_groups WHERE group_id = ?",
      [groupId]
    );
    if (Array.isArray(groupRows) && groupRows.length > 0) {
      const leaderId = (groupRows[0] as { team_leader_id: number }).team_leader_id;
      if (leaderId === studentId) {
        throw new Error(
          "Cannot remove the team leader. Please reassign the team leader before removing this member."
        );
      }
    }

    // Mark as inactive
    const [result] = await conn.execute(
      `UPDATE group_members
       SET membership_status = 'Inactive', left_at = CURRENT_TIMESTAMP
       WHERE group_id = ? AND student_id = ? AND membership_status = 'Active'`,
      [groupId, studentId]
    );

    if ((result as { affectedRows: number }).affectedRows > 0) {
      await conn.execute(
        "UPDATE project_groups SET team_size = GREATEST(1, team_size - 1) WHERE group_id = ?",
        [groupId]
      );
    }
  });
}

