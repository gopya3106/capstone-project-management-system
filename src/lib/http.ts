import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import type { SessionPayload, UserRole } from "@/lib/auth/types";

/**
 * Shared helpers for the workflow API routes.
 */

/** Error thrown by services for expected, user-facing failures. */
export class ServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * Returns the session when the caller has one of `roles`,
 * otherwise a ready-to-return 401 / 403 response.
 */
export async function authorize(
  roles: UserRole[]
): Promise<{ session: SessionPayload; response?: never } | { session?: never; response: NextResponse }> {
  const session = await getSession();
  if (!session) {
    return {
      response: NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 }),
    };
  }
  if (!roles.includes(session.role)) {
    return {
      response: NextResponse.json(
        { success: false, message: `Access denied. Required role(s): ${roles.join(", ")}.` },
        { status: 403 }
      ),
    };
  }
  return { session };
}

/** Reads the MySQL error text (SIGNAL message, CHECK name, duplicate key ...). */
export function mysqlMessage(error: unknown): string | null {
  const e = error as { sqlMessage?: string; errno?: number; code?: string };
  if (!e || typeof e !== "object") return null;
  if (e.errno === 1062 || e.code === "ER_DUP_ENTRY") return "This record already exists.";
  if (e.errno === 3819) {
    const name = /'([^']+)'/.exec(e.sqlMessage || "")?.[1];
    return `The value breaks the database rule ${name ? `"${name}"` : "for this field"}.`;
  }
  if (e.errno === 1451) return "This record is still referenced by other records and cannot be removed.";
  return e.sqlMessage || null;
}

/**
 * Converts any thrown error into a JSON error response.
 *  - ZodError          -> 400 with field errors
 *  - ServiceError      -> its status code
 *  - MySQL SIGNAL 45000 (errno 1644), CHECK (3819) -> 400; duplicate key -> 409
 *  - anything else     -> 500 (details logged on the server only)
 */
export function errorResponse(error: unknown, scope: string): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, message: "Validation failed.", errors: error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  if (error instanceof ServiceError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
  }
  const errno = (error as { errno?: number })?.errno;
  const dbMessage = mysqlMessage(error);
  if (dbMessage && (errno === 1644 || errno === 3819 || errno === 1062 || errno === 1451)) {
    return NextResponse.json(
      { success: false, message: dbMessage },
      { status: errno === 1062 ? 409 : 400 }
    );
  }
  console.error(`[${scope}]`, error instanceof Error ? error.message : error);
  return NextResponse.json({ success: false, message: "An internal error occurred." }, { status: 500 });
}

/** Parses a positive integer route / query parameter. */
export function parseId(value: string | null | undefined, label = "ID"): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ServiceError(`${label} must be a positive integer.`);
  }
  return id;
}
