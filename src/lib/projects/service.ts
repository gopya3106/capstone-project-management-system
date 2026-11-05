import { query } from "@/lib/mysql";
import {
  ProjectListItem,
  ProjectDetails,
  ProjectFilterParams,
  ProjectStats,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectTeamMember,
  ProjectMentorAllocation,
  AvailableGroupForProject,
} from "./types";

/**
 * Retrieves aggregate metrics across all capstone projects.
 */
export async function getProjectStats(): Promise<ProjectStats> {
  const countsSql = `
    SELECT
      COUNT(*) AS totalProjects,
      SUM(CASE WHEN project_status IN ('Proposed','Under Review','Approved') THEN 1 ELSE 0 END) AS notStartedCount,
      SUM(CASE WHEN project_status = 'In Progress' THEN 1 ELSE 0 END) AS inProgressCount,
      SUM(CASE WHEN project_status = 'On Hold' THEN 1 ELSE 0 END) AS onHoldCount,
      SUM(CASE WHEN project_status = 'Completed' THEN 1 ELSE 0 END) AS completedCount
    FROM capstone_projects
  `;
  const [counts] = await query<Array<{
    totalProjects: number;
    notStartedCount: number;
    inProgressCount: number;
    onHoldCount: number;
    completedCount: number;
  }>>(countsSql);

  const mentorCountSql = `
    SELECT COUNT(DISTINCT project_id) AS withPrimaryMentorCount
    FROM mentor_allocations
    WHERE mentor_role = 'Primary' AND allocation_status = 'Active'
  `;
  const [mentorCount] = await query<Array<{ withPrimaryMentorCount: number }>>(mentorCountSql);

  return {
    totalProjects: Number(counts?.totalProjects || 0),
    notStartedCount: Number(counts?.notStartedCount || 0),
    inProgressCount: Number(counts?.inProgressCount || 0),
    onHoldCount: Number(counts?.onHoldCount || 0),
    completedCount: Number(counts?.completedCount || 0),
    withPrimaryMentorCount: Number(mentorCount?.withPrimaryMentorCount || 0),
  };
}

/**
 * Queries a filtered, paginated list of capstone projects.
 */
export async function getProjects(
  filters: ProjectFilterParams = {}
): Promise<{ projects: ProjectListItem[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    conditions.push(
      "(cp.project_title LIKE ? OR pg.group_name LIKE ? OR ldr_u.full_name LIKE ? OR ldr_s.usn LIKE ? OR pri_m.primary_mentor_name LIKE ?)"
    );
    const searchPattern = `%${filters.search.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (filters.status) {
    conditions.push("cp.project_status = ?");
    params.push(filters.status);
  }

  if (filters.domain) {
    conditions.push("cp.project_domain = ?");
    params.push(filters.domain.trim());
  }

  if (filters.department) {
    conditions.push("pg.department = ?");
    params.push(filters.department.trim());
  }

  if (filters.academic_year) {
    conditions.push("pg.academic_year = ?");
    params.push(filters.academic_year.trim());
  }

  if (filters.phase_id !== undefined) {
    conditions.push("cp.current_phase_id = ?");
    params.push(filters.phase_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count total matching
  const countSql = `
    SELECT COUNT(DISTINCT cp.project_id) AS total
    FROM capstone_projects cp
    JOIN project_groups pg ON cp.group_id = pg.group_id
    LEFT JOIN students ldr_s ON pg.team_leader_id = ldr_s.student_id
    LEFT JOIN users ldr_u ON ldr_s.user_id = ldr_u.user_id
    LEFT JOIN (
      SELECT ma.project_id, u.full_name AS primary_mentor_name
      FROM mentor_allocations ma
      JOIN capstone_mentors cm ON ma.mentor_id = cm.mentor_id
      JOIN users u ON cm.user_id = u.user_id
      WHERE ma.mentor_role = 'Primary' AND ma.allocation_status = 'Active'
    ) pri_m ON cp.project_id = pri_m.project_id
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
      cp.project_id,
      cp.group_id,
      cp.project_title,
      cp.project_status,
      cp.project_domain,
      pg.group_name,
      pg.department,
      pg.academic_year,
      pg.batch,
      pg.team_leader_id,
      COALESCE(ldr_u.full_name, 'Unassigned') AS team_leader_name,
      COALESCE(ldr_s.usn, '') AS team_leader_usn,
      pri_m.primary_mentor_id,
      pri_m.primary_mentor_name,
      pri_m.primary_mentor_email,
      cp.current_phase_id,
      p.phase_name AS current_phase_name,
      p.phase_number,
      cp.start_date
    FROM capstone_projects cp
    JOIN project_groups pg ON cp.group_id = pg.group_id
    LEFT JOIN students ldr_s ON pg.team_leader_id = ldr_s.student_id
    LEFT JOIN users ldr_u ON ldr_s.user_id = ldr_u.user_id
    LEFT JOIN capstone_phases p ON cp.current_phase_id = p.phase_id
    LEFT JOIN (
      SELECT ma.project_id, ma.mentor_id AS primary_mentor_id, u.full_name AS primary_mentor_name, u.email AS primary_mentor_email
      FROM mentor_allocations ma
      JOIN capstone_mentors cm ON ma.mentor_id = cm.mentor_id
      JOIN users u ON cm.user_id = u.user_id
      WHERE ma.mentor_role = 'Primary' AND ma.allocation_status = 'Active'
    ) pri_m ON cp.project_id = pri_m.project_id
    ${whereClause}
    ORDER BY cp.project_id DESC
    LIMIT ? OFFSET ?
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryParams: any[] = [...params, limit, offset];
  const projects = await query<ProjectListItem[]>(dataSql, queryParams);

  return { projects, total };
}

/**
 * Retrieves full details for a single capstone project including team members roster and mentor allocations.
 */
export async function getProjectById(projectId: number): Promise<ProjectDetails | null> {
  const baseSql = `
    SELECT
      cp.project_id,
      cp.group_id,
      cp.project_title,
      cp.problem_statement,
      cp.objectives,
      cp.scope,
      cp.project_domain,
      cp.project_type,
      cp.proposed_methodology,
      cp.technology_stack,
      cp.current_phase_id,
      p.phase_name AS current_phase_name,
      p.phase_number,
      cp.project_status,
      cp.start_date,
      cp.expected_end_date,
      cp.completion_date,
      cp.repository_url,
      pg.group_name,
      pg.department,
      pg.academic_year,
      pg.batch,
      pg.team_leader_id,
      COALESCE(ldr_u.full_name, 'Unassigned') AS team_leader_name,
      COALESCE(ldr_s.usn, '') AS team_leader_usn,
      pri_m.primary_mentor_id,
      pri_m.primary_mentor_name,
      pri_m.primary_mentor_email
    FROM capstone_projects cp
    JOIN project_groups pg ON cp.group_id = pg.group_id
    LEFT JOIN students ldr_s ON pg.team_leader_id = ldr_s.student_id
    LEFT JOIN users ldr_u ON ldr_s.user_id = ldr_u.user_id
    LEFT JOIN capstone_phases p ON cp.current_phase_id = p.phase_id
    LEFT JOIN (
      SELECT ma.project_id, ma.mentor_id AS primary_mentor_id, u.full_name AS primary_mentor_name, u.email AS primary_mentor_email
      FROM mentor_allocations ma
      JOIN capstone_mentors cm ON ma.mentor_id = cm.mentor_id
      JOIN users u ON cm.user_id = u.user_id
      WHERE ma.mentor_role = 'Primary' AND ma.allocation_status = 'Active'
    ) pri_m ON cp.project_id = pri_m.project_id
    WHERE cp.project_id = ?
    LIMIT 1
  `;

  const rows = await query<ProjectDetails[]>(baseSql, [projectId]);
  if (!rows || rows.length === 0) {
    return null;
  }
  const project = rows[0];

  // Load team members
  const membersSql = `
    SELECT
      gm.student_id,
      s.usn,
      u.full_name,
      u.email,
      gm.member_role
    FROM group_members gm
    JOIN students s ON gm.student_id = s.student_id
    JOIN users u ON s.user_id = u.user_id
    WHERE gm.group_id = ? AND gm.membership_status = 'Active'
    ORDER BY (gm.member_role = 'Leader') DESC, s.usn ASC
  `;
  const teamMembers = await query<ProjectTeamMember[]>(membersSql, [project.group_id]);

  // Load mentor allocations (both active and past)
  const mentorsSql = `
    SELECT
      ma.allocation_id,
      ma.mentor_id,
      u_m.full_name AS mentor_name,
      u_m.email AS mentor_email,
      cm.employee_id,
      cm.designation,
      cm.specialization,
      ma.mentor_role,
      ma.allocation_status,
      ma.allocation_date,
      ma.end_date,
      ma.remarks,
      u_adm.full_name AS allocated_by_name
    FROM mentor_allocations ma
    JOIN capstone_mentors cm ON ma.mentor_id = cm.mentor_id
    JOIN users u_m ON cm.user_id = u_m.user_id
    LEFT JOIN users u_adm ON ma.allocated_by = u_adm.user_id
    WHERE ma.project_id = ?
    ORDER BY (ma.allocation_status = 'Active') DESC, (ma.mentor_role = 'Primary') DESC, ma.allocation_date DESC
  `;
  const mentorAllocations = await query<ProjectMentorAllocation[]>(mentorsSql, [projectId]);

  return {
    ...project,
    team_members: teamMembers || [],
    mentor_allocations: mentorAllocations || [],
  };
}

/**
 * Returns active capstone groups that do not yet have an associated Capstone Project.
 */
export async function getAvailableGroupsForProject(): Promise<AvailableGroupForProject[]> {
  const sql = `
    SELECT
      pg.group_id,
      pg.group_name,
      pg.department,
      pg.batch,
      pg.academic_year,
      COALESCE(u.full_name, 'Unassigned') AS team_leader_name,
      COALESCE(s.usn, '') AS team_leader_usn,
      pg.team_size
    FROM project_groups pg
    LEFT JOIN students s ON pg.team_leader_id = s.student_id
    LEFT JOIN users u ON s.user_id = u.user_id
    WHERE pg.group_status != 'Disbanded'
      AND NOT EXISTS (
        SELECT 1 FROM capstone_projects cp WHERE cp.group_id = pg.group_id
      )
    ORDER BY pg.formation_date DESC, pg.group_id DESC
  `;
  return query<AvailableGroupForProject[]>(sql);
}

/**
 * Creates a new Capstone Project linked to an existing group.
 * Enforces the UNIQUE group_id constraint so a group cannot have multiple projects.
 */
export async function createProject(input: CreateProjectInput): Promise<{
  project_id: number;
  project_title: string;
  group_id: number;
}> {
  // 1. Verify target group exists and is not disbanded
  const groupRows = await query<Array<{ group_id: number; group_name: string; group_status: string }>>(
    "SELECT group_id, group_name, group_status FROM project_groups WHERE group_id = ? LIMIT 1",
    [input.group_id]
  );
  if (!groupRows || groupRows.length === 0) {
    throw new Error(`Capstone group #${input.group_id} does not exist.`);
  }
  const group = groupRows[0];
  if (group.group_status === "Disbanded") {
    throw new Error(`Cannot link a project to disbanded group "${group.group_name}".`);
  }

  // 2. Check for duplicate project on this group (unique group_id constraint)
  const existingProject = await query<Array<{ project_id: number; project_title: string }>>(
    "SELECT project_id, project_title FROM capstone_projects WHERE group_id = ? LIMIT 1",
    [input.group_id]
  );
  if (existingProject && existingProject.length > 0) {
    throw new Error(
      `Group "${group.group_name}" is already linked to project "${existingProject[0].project_title}". Each group can have at most one project.`
    );
  }

  // 3. Insert into capstone_projects
  const insertSql = `
    INSERT INTO capstone_projects (
      group_id,
      project_title,
      problem_statement,
      objectives,
      scope,
      project_domain,
      project_type,
      proposed_methodology,
      technology_stack,
      current_phase_id,
      project_status,
      start_date,
      expected_end_date,
      repository_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [
    input.group_id,
    input.project_title.trim(),
    input.problem_statement?.trim() || null,
    input.objectives?.trim() || null,
    input.scope?.trim() || null,
    input.project_domain?.trim() || null,
    input.project_type?.trim() || null,
    input.proposed_methodology?.trim() || null,
    input.technology_stack?.trim() || null,
    input.current_phase_id || 1, // default to Phase 1 (Problem Definition & Planning)
    input.project_status || "Proposed",
    input.start_date || new Date().toISOString().slice(0, 10),
    input.expected_end_date || null,
    input.repository_url?.trim() || null,
  ];

  const result = await query<{ insertId: number }>(insertSql, params);

  return {
    project_id: result.insertId,
    project_title: input.project_title.trim(),
    group_id: input.group_id,
  };
}

/**
 * Updates an existing Capstone Project record.
 */
export async function updateProject(
  projectId: number,
  input: UpdateProjectInput
): Promise<void> {
  // 1. Verify project exists
  const existing = await query<Array<{ project_id: number }>>(
    "SELECT project_id FROM capstone_projects WHERE project_id = ? LIMIT 1",
    [projectId]
  );
  if (!existing || existing.length === 0) {
    throw new Error(`Capstone project #${projectId} not found.`);
  }

  const updates: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (input.project_title) {
    updates.push("project_title = ?");
    params.push(input.project_title.trim());
  }
  if (input.problem_statement !== undefined) {
    updates.push("problem_statement = ?");
    params.push(input.problem_statement ? input.problem_statement.trim() : null);
  }
  if (input.objectives !== undefined) {
    updates.push("objectives = ?");
    params.push(input.objectives ? input.objectives.trim() : null);
  }
  if (input.scope !== undefined) {
    updates.push("scope = ?");
    params.push(input.scope ? input.scope.trim() : null);
  }
  if (input.project_domain !== undefined) {
    updates.push("project_domain = ?");
    params.push(input.project_domain ? input.project_domain.trim() : null);
  }
  if (input.project_type !== undefined) {
    updates.push("project_type = ?");
    params.push(input.project_type ? input.project_type.trim() : null);
  }
  if (input.proposed_methodology !== undefined) {
    updates.push("proposed_methodology = ?");
    params.push(input.proposed_methodology ? input.proposed_methodology.trim() : null);
  }
  if (input.technology_stack !== undefined) {
    updates.push("technology_stack = ?");
    params.push(input.technology_stack ? input.technology_stack.trim() : null);
  }
  if (input.current_phase_id !== undefined) {
    updates.push("current_phase_id = ?");
    params.push(input.current_phase_id);
  }
  if (input.project_status) {
    updates.push("project_status = ?");
    params.push(input.project_status);
  }
  if (input.start_date !== undefined) {
    updates.push("start_date = ?");
    params.push(input.start_date || null);
  }
  if (input.expected_end_date !== undefined) {
    updates.push("expected_end_date = ?");
    params.push(input.expected_end_date || null);
  }
  if (input.completion_date !== undefined) {
    updates.push("completion_date = ?");
    params.push(input.completion_date || null);
  }
  if (input.repository_url !== undefined) {
    updates.push("repository_url = ?");
    params.push(input.repository_url ? input.repository_url.trim() : null);
  }

  if (updates.length > 0) {
    params.push(projectId);
    await query(`UPDATE capstone_projects SET ${updates.join(", ")} WHERE project_id = ?`, params);
  }
}

