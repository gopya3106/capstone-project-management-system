import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  getProjects,
  getProjectStats,
  createProject,
  projectFilterSchema,
  createProjectSchema,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/projects
 * Lists projects with filtering, pagination, and aggregate project statistics.
 */
export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const parsedParams = projectFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      domain: searchParams.get("domain") || undefined,
      department: searchParams.get("department") || undefined,
      academic_year: searchParams.get("academic_year") || undefined,
      phase_id: searchParams.get("phase_id") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const [result, stats] = await Promise.all([
      getProjects(parsedParams),
      getProjectStats(),
    ]);

    return NextResponse.json({
      success: true,
      projects: result.projects,
      total: result.total,
      page: parsedParams.page,
      limit: parsedParams.limit,
      stats,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid query parameters.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    console.error("[GET /api/admin/projects] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An internal error occurred while fetching projects.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/projects
 * Creates a new capstone project linked to an existing group.
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
    const validatedInput = createProjectSchema.parse(body);

    const newProject = await createProject(validatedInput);

    return NextResponse.json(
      {
        success: true,
        message: "Capstone project registered successfully.",
        project: newProject,
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
      message.includes("already linked to project") ||
      message.includes("already has a registered project") ||
      message.includes("Duplicate entry");

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: isConflict ? 409 : 400 }
    );
  }
}
