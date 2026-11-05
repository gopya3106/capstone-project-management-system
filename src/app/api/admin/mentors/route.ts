import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  getMentors,
  getMentorStats,
  mentorFilterSchema,
} from "@/lib/mentors";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/mentors
 * Retrieves all mentors with current workload, capacity metrics, and assigned projects.
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
    const hasCapacityParam = searchParams.get("hasCapacity");
    const parsedParams = mentorFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      department: searchParams.get("department") || undefined,
      specialization: searchParams.get("specialization") || undefined,
      availability: searchParams.get("availability") || undefined,
      hasCapacity: hasCapacityParam ? (hasCapacityParam === "true" ? "true" : "false") : undefined,
    });

    const [result, stats] = await Promise.all([
      getMentors({
        search: parsedParams.search,
        department: parsedParams.department,
        specialization: parsedParams.specialization,
        availability: parsedParams.availability,
        hasCapacity:
          parsedParams.hasCapacity !== undefined
            ? parsedParams.hasCapacity === "true"
            : undefined,
      }),
      getMentorStats(),
    ]);

    return NextResponse.json({
      success: true,
      mentors: result.mentors,
      total: result.total,
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

    console.error("[GET /api/admin/mentors] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An internal error occurred while fetching mentors.",
      },
      { status: 500 }
    );
  }
}

