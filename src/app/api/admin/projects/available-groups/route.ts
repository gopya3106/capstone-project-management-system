import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAvailableGroupsForProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/projects/available-groups
 * Lists all active project groups that do not yet have an assigned Capstone Project.
 */
export async function GET() {
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
    const groups = await getAvailableGroupsForProject();
    return NextResponse.json({ success: true, groups });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error.";
    console.error("[GET /api/admin/projects/available-groups] Error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

