import { query, withTransaction } from "@/lib/mysql";
import { hashPassword } from "@/lib/auth/service";
import {
  StudentListItem,
  StudentDetails,
  StudentFilterParams,
  StudentStats,
  CreateStudentInput,
  UpdateStudentInput,
  StudentGroupMemberSummary,
  StudentPastGroup,
} from "./types";

/**
 * Retrieves aggregate statistics for student enrollment and group allocation.
 */
export async function getStudentStats(): Promise<StudentStats> {
  const countsSql = `
    SELECT
      COUNT(*) AS totalStudents,
      SUM(CASE WHEN academic_status = 'Active' THEN 1 ELSE 0 END) AS activeStudents
    FROM students
  `;
  const [counts] = await query<Array<{ totalStudents: number; activeStudents: number }>>(countsSql);

  const assignedSql = `
    SELECT COUNT(DISTINCT s.student_id) AS assignedStudents
    FROM students s
    JOIN group_members gm ON s.student_id = gm.student_id AND gm.membership_status = 'Active'
    JOIN project_groups pg ON gm.group_id = pg.group_id AND pg.group_status != 'Disbanded'
    WHERE s.academic_status = 'Active'
  `;
  const [assigned] = await query<Array<{ assignedStudents: number }>>(assignedSql);

  const total = Number(counts?.totalStudents || 0);
  const active = Number(counts?.activeStudents || 0);
  const assignedCount = Number(assigned?.assignedStudents || 0);
  const unassignedCount = Math.max(0, active - assignedCount);

  return {
    totalStudents: total,
    activeStudents: active,
    assignedStudents: assignedCount,
    unassignedStudents: unassignedCount,
  };
}

/**
 * Queries a filtered, paginated list of students.
 */
export async function getStudents(
  filters: StudentFilterParams = {}
): Promise<{ students: StudentListItem[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    conditions.push(
      "(s.usn LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)"
    );
    const searchPattern = `%${filters.search.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (filters.department) {
    conditions.push("s.department = ?");
    params.push(filters.department.trim());
  }

  if (filters.batch) {
    conditions.push("s.batch = ?");
    params.push(filters.batch.trim());
  }

  if (filters.semester !== undefined) {
    conditions.push("s.current_semester = ?");
    params.push(filters.semester);
  }

  if (filters.section) {
    conditions.push("s.section = ?");
    params.push(filters.section.trim());
  }

  if (filters.status) {
    conditions.push("s.academic_status = ?");
    params.push(filters.status);
  }

  if (filters.groupStatus === "assigned") {
    conditions.push("active_gm.group_id IS NOT NULL");
  } else if (filters.groupStatus === "unassigned") {
    conditions.push("active_gm.group_id IS NULL");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count total matching
  const countSql = `
    SELECT COUNT(DISTINCT s.student_id) AS total
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    LEFT JOIN group_members active_gm ON s.student_id = active_gm.student_id AND active_gm.membership_status = 'Active'
    LEFT JOIN project_groups active_pg ON active_gm.group_id = active_pg.group_id AND active_pg.group_status != 'Disbanded'
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
      s.student_id,
      s.user_id,
      s.usn,
      u.full_name,
      u.email,
      s.department,
      s.specialization,
      s.batch,
      s.current_semester,
      s.section,
      s.cgpa,
      s.academic_status,
      active_gm.group_id AS active_group_id,
      active_pg.group_name AS active_group_name,
      active_gm.member_role AS group_role
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    LEFT JOIN group_members active_gm ON s.student_id = active_gm.student_id AND active_gm.membership_status = 'Active'
    LEFT JOIN project_groups active_pg ON active_gm.group_id = active_pg.group_id AND active_pg.group_status != 'Disbanded'
    ${whereClause}
    ORDER BY s.usn ASC
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, limit, offset];
  const students = await query<StudentListItem[]>(dataSql, queryParams);

  return { students, total };
}

/**
 * Retrieves full details for a single student including active and past group affiliations.
 */
export async function getStudentById(studentId: number): Promise<StudentDetails | null> {
  const baseSql = `
    SELECT
      s.student_id,
      s.user_id,
      s.usn,
      u.full_name,
      u.email,
      u.phone_number,
      u.created_at,
      s.department,
      s.specialization,
      s.batch,
      s.current_semester,
      s.section,
      s.cgpa,
      s.academic_status,
      active_gm.group_id AS active_group_id,
      active_pg.group_name AS active_group_name,
      active_gm.member_role AS group_role
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    LEFT JOIN group_members active_gm ON s.student_id = active_gm.student_id AND active_gm.membership_status = 'Active'
    LEFT JOIN project_groups active_pg ON active_gm.group_id = active_pg.group_id AND active_pg.group_status != 'Disbanded'
    WHERE s.student_id = ?
    LIMIT 1
  `;

  const rows = await query<StudentDetails[]>(baseSql, [studentId]);
  if (!rows || rows.length === 0) {
    return null;
  }

  const student = rows[0];

  // If in an active group, load group details, team members, and linked project
  let activeGroup = null;
  if (student.active_group_id) {
    const groupSql = `
      SELECT
        pg.group_id,
        pg.group_name,
        pg.department,
        pg.batch,
        pg.academic_year,
        pg.formation_date,
        pg.group_status,
        cp.project_id,
        cp.project_title,
        cp.project_status
      FROM project_groups pg
      LEFT JOIN capstone_projects cp ON pg.group_id = cp.group_id
      WHERE pg.group_id = ?
      LIMIT 1
    `;
    const groupRows = await query<Array<{
      group_id: number;
      group_name: string;
      department: string;
      batch: string;
      academic_year: string;
      formation_date: string | Date;
      group_status: string;
      project_id: number | null;
      project_title: string | null;
      project_status: string | null;
    }>>(groupSql, [student.active_group_id]);

    if (groupRows && groupRows.length > 0) {
      const g = groupRows[0];

      // Query active members of this group
      const membersSql = `
        SELECT
          gm.student_id,
          st.usn,
          usr.full_name,
          usr.email,
          gm.member_role
        FROM group_members gm
        JOIN students st ON gm.student_id = st.student_id
        JOIN users usr ON st.user_id = usr.user_id
        WHERE gm.group_id = ? AND gm.membership_status = 'Active'
        ORDER BY (gm.member_role = 'Leader') DESC, st.usn ASC
      `;
      const members = await query<StudentGroupMemberSummary[]>(membersSql, [g.group_id]);

      activeGroup = {
        group_id: g.group_id,
        group_name: g.group_name,
        department: g.department,
        batch: g.batch,
        academic_year: g.academic_year,
        formation_date: g.formation_date,
        group_status: g.group_status,
        member_role: student.group_role || "Member",
        project_id: g.project_id,
        project_title: g.project_title,
        project_status: g.project_status,
        members,
      };
    }
  }

  // Query past group memberships
  const pastSql = `
    SELECT
      gm.group_id,
      pg.group_name,
      gm.member_role,
      gm.membership_status,
      gm.joined_at,
      gm.left_at
    FROM group_members gm
    JOIN project_groups pg ON gm.group_id = pg.group_id
    WHERE gm.student_id = ?
      AND (gm.membership_status = 'Inactive' OR pg.group_status = 'Disbanded')
    ORDER BY gm.joined_at DESC
  `;
  const pastGroups = await query<StudentPastGroup[]>(pastSql, [studentId]);

  return {
    ...student,
    active_group: activeGroup,
    past_groups: pastGroups || [],
  };
}

/**
 * Returns active students who are not assigned to any active, non-disbanded group.
 */
export async function getAvailableStudents(
  department?: string,
  batch?: string
): Promise<Array<{
  student_id: number;
  user_id: number;
  usn: string;
  full_name: string;
  email: string;
  department: string;
  batch: string;
  current_semester: number | null;
  section: string | null;
  cgpa: number | string | null;
}>> {
  const conditions: string[] = [
    "s.academic_status = 'Active'",
    `NOT EXISTS (
      SELECT 1 FROM group_members gm
      JOIN project_groups pg ON gm.group_id = pg.group_id
      WHERE gm.student_id = s.student_id
        AND gm.membership_status = 'Active'
        AND pg.group_status != 'Disbanded'
    )`,
  ];
  const params: unknown[] = [];

  if (department) {
    conditions.push("s.department = ?");
    params.push(department.trim());
  }
  if (batch) {
    conditions.push("s.batch = ?");
    params.push(batch.trim());
  }

  const sql = `
    SELECT
      s.student_id,
      s.user_id,
      s.usn,
      u.full_name,
      u.email,
      s.department,
      s.batch,
      s.current_semester,
      s.section,
      s.cgpa
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY s.usn ASC
  `;

  return query(sql, params);
}

/**
 * Creates a new student record and associated user account within a managed transaction.
 */
export async function createStudent(input: CreateStudentInput): Promise<{
  student_id: number;
  user_id: number;
  usn: string;
}> {
  return withTransaction(async (conn) => {
    // 1. Check for duplicate email or USN
    const [existingUsers] = await conn.execute(
      "SELECT user_id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [input.email.trim()]
    );
    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      throw new Error(`A user with email "${input.email}" already exists.`);
    }

    const [existingStudents] = await conn.execute(
      "SELECT student_id FROM students WHERE UPPER(usn) = UPPER(?) LIMIT 1",
      [input.usn.trim()]
    );
    if (Array.isArray(existingStudents) && existingStudents.length > 0) {
      throw new Error(`A student with USN "${input.usn}" already exists.`);
    }

    // 2. Hash initial password (default to USN-based or provided secure password)
    const rawPassword = input.initial_password || `Cpms@${input.usn.trim()}`;
    const passwordHash = await hashPassword(rawPassword);

    // 3. Insert into Users table
    const [userResult] = await conn.execute(
      `INSERT INTO users (full_name, email, password_hash, role, phone_number, account_status)
       VALUES (?, ?, ?, 'Student', ?, 'Active')`,
      [
        input.full_name.trim(),
        input.email.trim(),
        passwordHash,
        input.phone_number?.trim() || null,
      ]
    );
    const userId = (userResult as { insertId: number }).insertId;

    // 4. Insert into Students table
    const [studentResult] = await conn.execute(
      `INSERT INTO students (user_id, usn, department, specialization, batch, current_semester, section, cgpa, academic_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [
        userId,
        input.usn.trim().toUpperCase(),
        input.department.trim(),
        input.specialization?.trim() || null,
        input.batch.trim(),
        input.current_semester,
        input.section?.trim() || null,
        input.cgpa ?? null,
      ]
    );
    const studentId = (studentResult as { insertId: number }).insertId;

    return {
      student_id: studentId,
      user_id: userId,
      usn: input.usn.trim().toUpperCase(),
    };
  });
}

/**
 * Updates an existing student record within a transaction.
 */
export async function updateStudent(
  studentId: number,
  input: UpdateStudentInput
): Promise<void> {
  return withTransaction(async (conn) => {
    // 1. Verify student exists
    const [existing] = await conn.execute(
      "SELECT student_id, user_id FROM students WHERE student_id = ? LIMIT 1",
      [studentId]
    );
    if (!Array.isArray(existing) || existing.length === 0) {
      throw new Error(`Student with ID ${studentId} not found.`);
    }
    const student = existing[0] as { student_id: number; user_id: number };

    // 2. Update Users table if full_name or phone_number provided
    if (input.full_name || input.phone_number !== undefined) {
      const userUpdates: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userParams: any[] = [];

      if (input.full_name) {
        userUpdates.push("full_name = ?");
        userParams.push(input.full_name.trim());
      }
      if (input.phone_number !== undefined) {
        userUpdates.push("phone_number = ?");
        userParams.push(input.phone_number ? input.phone_number.trim() : null);
      }

      if (userUpdates.length > 0) {
        userParams.push(student.user_id);
        await conn.execute(
          `UPDATE users SET ${userUpdates.join(", ")} WHERE user_id = ?`,
          userParams
        );
      }
    }

    // 3. Update Students table
    const studentUpdates: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentParams: any[] = [];

    if (input.department) {
      studentUpdates.push("department = ?");
      studentParams.push(input.department.trim());
    }
    if (input.specialization !== undefined) {
      studentUpdates.push("specialization = ?");
      studentParams.push(input.specialization ? input.specialization.trim() : null);
    }
    if (input.batch) {
      studentUpdates.push("batch = ?");
      studentParams.push(input.batch.trim());
    }
    if (input.current_semester !== undefined) {
      studentUpdates.push("current_semester = ?");
      studentParams.push(input.current_semester);
    }
    if (input.section !== undefined) {
      studentUpdates.push("section = ?");
      studentParams.push(input.section ? input.section.trim() : null);
    }
    if (input.cgpa !== undefined) {
      studentUpdates.push("cgpa = ?");
      studentParams.push(input.cgpa);
    }
    if (input.academic_status) {
      studentUpdates.push("academic_status = ?");
      studentParams.push(input.academic_status);
    }

    if (studentUpdates.length > 0) {
      studentParams.push(studentId);
      await conn.execute(
        `UPDATE students SET ${studentUpdates.join(", ")} WHERE student_id = ?`,
        studentParams
      );
    }
  });
}
