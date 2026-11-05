import { getSession } from "./session";
import { SessionPayload, UserRole } from "./types";

export class AuthenticationError extends Error {
  statusCode = 401;
  constructor(message = "Authentication required. Please log in.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  statusCode = 403;
  constructor(message = "Access denied: Insufficient role permissions.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Validates that an active session exists.
 * Throws an AuthenticationError (401) if not logged in.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthenticationError();
  }
  return session;
}

/**
 * Validates that the active session user has one of the required roles.
 * Throws AuthenticationError (401) if not logged in,
 * or AuthorizationError (403) if role is unauthorized.
 */
export async function requireRole(
  allowedRoles: UserRole | UserRole[]
): Promise<SessionPayload> {
  const session = await requireAuth();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(session.role)) {
    throw new AuthorizationError(
      `Access denied. Required role(s): ${roles.join(", ")}.`
    );
  }

  return session;
}

/**
 * Convenience check for Student role.
 */
export async function requireStudent(): Promise<SessionPayload> {
  return requireRole("Student");
}

/**
 * Convenience check for Mentor role.
 */
export async function requireMentor(): Promise<SessionPayload> {
  return requireRole("Mentor");
}

/**
 * Convenience check for Admin role.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  return requireRole("Admin");
}

/**
 * Convenience check for Coordinator role.
 */
export async function requireCoordinator(): Promise<SessionPayload> {
  return requireRole("Coordinator");
}

/**
 * Staff = Admin or Coordinator (proposal review, milestones, guide allocation, reports).
 */
export async function requireStaff(): Promise<SessionPayload> {
  return requireRole(["Admin", "Coordinator"]);
}

export function isStaffRole(role: UserRole): boolean {
  return role === "Admin" || role === "Coordinator";
}

/**
 * Maps a verified role to its dedicated dashboard route.
 */
export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case "Student":
      return "/dashboard/student";
    case "Mentor":
      return "/dashboard/mentor";
    case "Coordinator":
    case "Admin":
      return "/dashboard/admin";
  }
}

