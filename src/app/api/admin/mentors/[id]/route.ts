import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  getMentorById,
  updateMentor,
  updateMentorSchema,
} from "@/lib/mentors";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/mentors/[id]
 * Retrieves complete mentor profile including historical and active allocations.
 */
export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 }
    );
  }
  if (session.role !== "Admin" && session.role !== "Coordinator") {
    return NextResponse.json(
      { success: false, message: "Access denied. Administrator or coordinator privileges required." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const mentorId = parseInt(id, 10);
  if (isNaN(mentorId) || mentorId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid mentor ID." },
      { status: 400 }
    );
  }

  try {
    const mentor = await getMentorById(mentorId);
    if (!mentor) {
      return NextResponse.json(
        { success: false, message: `Mentor #${mentorId} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, mentor });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error.";
    console.error(`[GET /api/admin/mentors/${mentorId}] Error:`, error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/mentors/[id]
 * Updates mentor profile details, capacity, and availability status.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 }
    );
  }
  if (session.role !== "Admin" && session.role !== "Coordinator") {
    return NextResponse.json(
      { success: false, message: "Access denied. Administrator or coordinator privileges required." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const mentorId = parseInt(id, 10);
  if (isNaN(mentorId) || mentorId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid mentor ID." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const validatedInput = updateMentorSchema.parse(body);

    await updateMentor(mentorId, validatedInput);
    const updated = await getMentorById(mentorId);

    return NextResponse.json({
      success: true,
      message: "Mentor profile updated successfully.",
      mentor: updated,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

