/**
 * TypeScript types for CPMS Capstone Project Management.
 */

export const PROJECT_STATUSES = [
  "Proposed",
  "Under Review",
  "Approved",
  "Rejected",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectListItem {
  project_id: number;
  group_id: number;
  project_title: string;
  project_status: ProjectStatus;
  project_domain: string | null;
  group_name: string;
  department: string;
  academic_year: string;
  batch: string;
  team_leader_id: number;
  team_leader_name: string;
  team_leader_usn: string;
  primary_mentor_id: number | null;
  primary_mentor_name: string | null;
  primary_mentor_email: string | null;
  current_phase_id: number | null;
  current_phase_name: string | null;
  phase_number: number | null;
  start_date: string | Date | null;
  created_at?: string | Date | null;
}

export interface ProjectTeamMember {
  student_id: number;
  usn: string;
  full_name: string;
  email: string;
  member_role: "Leader" | "Member";
}

export interface ProjectMentorAllocation {
  allocation_id: number;
  mentor_id: number;
  mentor_name: string;
  mentor_email: string;
  employee_id: string;
  designation: string | null;
  specialization: string | null;
  mentor_role: "Primary" | "Co-Mentor";
  allocation_status: "Active" | "Ended";
  allocation_date: string | Date;
  end_date: string | Date | null;
  remarks: string | null;
  allocated_by_name: string | null;
}

export interface ProjectDetails extends ProjectListItem {
  problem_statement: string | null;
  objectives: string | null;
  scope: string | null;
  project_type: string | null;
  proposed_methodology: string | null;
  technology_stack: string | null;
  expected_end_date: string | Date | null;
  completion_date: string | Date | null;
  repository_url: string | null;
  team_members: ProjectTeamMember[];
  mentor_allocations: ProjectMentorAllocation[];
}

export interface ProjectFilterParams {
  search?: string;
  status?: ProjectStatus;
  domain?: string;
  department?: string;
  academic_year?: string;
  phase_id?: number;
  page?: number;
  limit?: number;
}

export interface ProjectStats {
  totalProjects: number;
  notStartedCount: number;
  inProgressCount: number;
  onHoldCount: number;
  completedCount: number;
  withPrimaryMentorCount: number;
}

export interface CreateProjectInput {
  group_id: number;
  project_title: string;
  problem_statement?: string | null;
  objectives?: string | null;
  scope?: string | null;
  project_domain?: string | null;
  project_type?: string | null;
  proposed_methodology?: string | null;
  technology_stack?: string | null;
  current_phase_id?: number | null;
  project_status?: ProjectStatus;
  start_date?: string | null;
  expected_end_date?: string | null;
  repository_url?: string | null;
}

export interface UpdateProjectInput {
  project_title?: string;
  problem_statement?: string | null;
  objectives?: string | null;
  scope?: string | null;
  project_domain?: string | null;
  project_type?: string | null;
  proposed_methodology?: string | null;
  technology_stack?: string | null;
  current_phase_id?: number | null;
  project_status?: ProjectStatus;
  start_date?: string | null;
  expected_end_date?: string | null;
  completion_date?: string | null;
  repository_url?: string | null;
}

export interface AvailableGroupForProject {
  group_id: number;
  group_name: string;
  department: string;
  batch: string;
  academic_year: string;
  team_leader_name: string;
  team_leader_usn: string;
  team_size: number;
}

