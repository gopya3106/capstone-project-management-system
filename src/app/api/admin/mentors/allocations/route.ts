import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  assignMentorToProject,
  endMentorAllocation,
  assignMentorSchema,
  endAllocationSchema,
} from "@/lib/mentors";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/mentors/allocations
 * Assigns a mentor as Primary or Co-Mentor to a capstone project.
 */
export async function POST(request: Request) {
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

  try {
    const body = await request.json();
    const validatedInput = assignMentorSchema.parse(body);

    const result = await assignMentorToProject(validatedInput, session.userId);

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        allocation_id: result.allocation_id,
      },
      { status: 201 }
    );
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
    const isConflict =
      message.includes("already actively assigned") ||
      message.includes("maximum workload capacity") ||
      message.includes("Unavailable");

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: isConflict ? 409 : 400 }
    );
  }
}

/**
 * DELETE /api/admin/mentors/allocations
 * Ends an active mentor allocation.
 */
export async function DELETE(request: Request) {
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

  try {
    const body = await request.json();
    const validatedInput = endAllocationSchema.parse(body);

    const result = await endMentorAllocation(
      validatedInput.allocation_id,
      validatedInput.remarks
    );

    return NextResponse.json({
      success: true,
      message: result.message,
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
    const status = message.includes("not found") ? 404 : 400;

    return NextResponse.json({ success: false, message }, { status });
  }
}

