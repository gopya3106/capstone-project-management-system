import { isMongoConfigured } from "@/lib/mongodb";
import {
  logProjectActivity,
  recordSubmissionHistory,
  recordMentorFeedback,
  getProjectActivities,
} from "@/lib/nosql";
import type {
  ActorRole,
  CreateSubmissionHistoryInput,
  CreateMentorFeedbackInput,
  ProjectActivityDocument,
} from "@/lib/nosql/types";
import type { UserRole } from "@/lib/auth/types";

/**
 * Best-effort bridge from MySQL workflow events to the MongoDB history
 * collections. MySQL is authoritative: these helpers never throw, and are
 * no-ops when MongoDB is not configured.
 */

export function actorRoleFor(role: UserRole): ActorRole {
  switch (role) {
    case "Student":
      return "student";
    case "Mentor":
      return "mentor";
    case "Coordinator":
      return "coordinator";
    case "Admin":
      return "admin";
  }
}

function warn(scope: string, error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  console.warn(`[CPMS history] ${scope} skipped (${name}).`);
}

export async function recordActivity(input: {
  projectId: number;
  actorId: number;
  actorRole: ActorRole;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isMongoConfigured()) return;
  try {
    await logProjectActivity(input);
  } catch (error) {
    warn("activity log", error);
  }
}

export async function recordSubmissionVersion(input: CreateSubmissionHistoryInput): Promise<void> {
  if (!isMongoConfigured()) return;
  try {
    await recordSubmissionHistory(input);
  } catch (error) {
    warn("submission history", error);
  }
}

export async function recordFeedback(input: CreateMentorFeedbackInput): Promise<void> {
  if (!isMongoConfigured()) return;
  try {
    await recordMentorFeedback(input);
  } catch (error) {
    warn("mentor feedback history", error);
  }
}

export async function getActivityTimeline(projectId: number, limit = 20): Promise<ProjectActivityDocument[]> {
  if (!isMongoConfigured()) return [];
  try {
    return await getProjectActivities(projectId, limit);
  } catch (error) {
    warn("activity timeline", error);
    return [];
  }
}
