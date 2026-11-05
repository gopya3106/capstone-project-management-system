/**
 * CPMS User Roles.
 * Strictly enforced across database queries, JWT claims, and authorization checks.
 */
export const USER_ROLES = ["Student", "Mentor", "Coordinator", "Admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Shape of the authoritative `Users` record in MySQL `cpms_db`.
 */
export interface DbUser {
  user_id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  account_status?: "Active" | "Inactive" | "Suspended";
  created_at: Date | string;
}

/**
 * Public, sanitized user object safe for client consumption.
 * Never includes `password_hash` or internal security tokens.
 */
export interface SafeUser {
  user_id: number;
  email: string;
  role: UserRole;
  created_at?: Date | string;
}

/**
 * Verified JWT session payload structure.
 */
export interface SessionPayload {
  sub: string;
  userId: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

