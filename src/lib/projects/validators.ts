import { z } from "zod";
import { PROJECT_STATUSES } from "./types";

export const projectFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  domain: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  academic_year: z.string().trim().max(9).optional(),
  phase_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createProjectSchema = z.object({
  group_id: z.coerce.number().int().positive("A valid group ID is required."),
  project_title: z
    .string()
    .trim()
    .min(3, "Project title must be at least 3 characters.")
    .max(200, "Project title cannot exceed 200 characters."),
  problem_statement: z.string().trim().optional().nullable(),
  objectives: z.string().trim().optional().nullable(),
  scope: z.string().trim().optional().nullable(),
  project_domain: z.string().trim().max(100).optional().nullable(),
  project_type: z.string().trim().max(50).optional().nullable(),
  proposed_methodology: z.string().trim().optional().nullable(),
  technology_stack: z.string().trim().optional().nullable(),
  current_phase_id: z.coerce.number().int().positive().optional().nullable(),
  project_status: z.enum(PROJECT_STATUSES).default("Proposed"),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format.")
    .optional()
    .nullable(),
  expected_end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected end date must be in YYYY-MM-DD format.")
    .optional()
    .nullable(),
  repository_url: z
    .string()
    .trim()
    .url("Repository URL must be a valid URL.")
    .max(500)
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const updateProjectSchema = z.object({
  project_title: z
    .string()
    .trim()
    .min(3, "Project title must be at least 3 characters.")
    .max(200, "Project title cannot exceed 200 characters.")
    .optional(),
  problem_statement: z.string().trim().optional().nullable(),
  objectives: z.string().trim().optional().nullable(),
  scope: z.string().trim().optional().nullable(),
  project_domain: z.string().trim().max(100).optional().nullable(),
  project_type: z.string().trim().max(50).optional().nullable(),
  proposed_methodology: z.string().trim().optional().nullable(),
  technology_stack: z.string().trim().optional().nullable(),
  current_phase_id: z.coerce.number().int().positive().optional().nullable(),
  project_status: z.enum(PROJECT_STATUSES).optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  expected_end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  completion_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  repository_url: z
    .string()
    .trim()
    .url("Repository URL must be a valid URL.")
    .max(500)
    .optional()
    .nullable()
    .or(z.literal("")),
});

