import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/mysql";
import { DbUser, SafeUser } from "./types";

/**
 * Validation schema for login payloads.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .max(255, "Email address is too long."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(128, "Password is too long."),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Queries the authoritative MySQL `Users` table by email using parameterized SQL.
 */
export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const sql = `
    SELECT user_id, email, password_hash, role, account_status, created_at
    FROM users
    WHERE LOWER(email) = LOWER(?)
    LIMIT 1
  `;
  const rows = await query<DbUser[]>(sql, [email.trim()]);
  if (!rows || rows.length === 0) {
    return null;
  }
  return rows[0];
}

/**
 * Queries safe user attributes by user_id.
 */
export async function findUserById(userId: number): Promise<SafeUser | null> {
  const sql = `
    SELECT user_id, email, role, created_at
    FROM users
    WHERE user_id = ?
    LIMIT 1
  `;
  const rows = await query<SafeUser[]>(sql, [userId]);
  if (!rows || rows.length === 0) {
    return null;
  }
  return rows[0];
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 * Safely handles invalid or placeholder hashes without crashing.
 */
export async function verifyPassword(
  plainText: string,
  hashed: string
): Promise<boolean> {
  if (!plainText || !hashed) {
    return false;
  }
  try {
    return await bcrypt.compare(plainText, hashed);
  } catch {
    // If the hash in the DB is a non-bcrypt placeholder, return false safely
    return false;
  }
}

/**
 * Hash a password using bcrypt with standard salt rounds.
 * (Utility for authorized administrator provisioning; public registration is disabled).
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 12);
}

/**
 * Authenticates user credentials.
 * Returns a generic error on failure to prevent email enumeration.
 */
export async function authenticateUser(input: LoginInput): Promise<SafeUser> {
  const normalizedEmail = input.email.trim();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const isMatch = await verifyPassword(input.password, user.password_hash);
  if (!isMatch) {
    throw new Error("Invalid email or password.");
  }

  if (user.account_status && user.account_status !== "Active") {
    throw new Error("This account is not active. Please contact the administrator.");
  }

  return {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  };
}

