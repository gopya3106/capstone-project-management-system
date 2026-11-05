import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  getProjectById,
  updateProject,
  updateProjectSchema,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/projects/[id]
 * Retrieves complete details for a single capstone project, including team roster and mentors.
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
  const projectId = parseInt(id, 10);
  if (isNaN(projectId) || projectId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid project ID." },
      { status: 400 }
    );
  }

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, message: `Capstone project #${projectId} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, project });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error.";
    console.error(`[GET /api/admin/projects/${projectId}] Error:`, error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/projects/[id]
 * Updates fields of a capstone project (status, phase, problem statement, repository URL, etc.).
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
  const projectId = parseInt(id, 10);
  if (isNaN(projectId) || projectId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid project ID." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const validatedInput = updateProjectSchema.parse(body);

    await updateProject(projectId, validatedInput);
    const updated = await getProjectById(projectId);

    return NextResponse.json({
      success: true,
      message: "Project updated successfully.",
      project: updated,
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

