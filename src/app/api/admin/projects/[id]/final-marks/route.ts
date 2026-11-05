import { NextResponse } from "next/server";
import { authorize, errorResponse, parseId } from "@/lib/http";
import { recalculateFinalMarks } from "@/lib/workflow";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/admin/projects/[id]/final-marks : run sp_calculate_final_marks */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await authorize(["Admin", "Coordinator"]);
  if (auth.response) return auth.response;
  try {
    const projectId = parseId((await context.params).id, "Project ID");
    const results = await recalculateFinalMarks(projectId);
    return NextResponse.json({ success: true, message: "Final marks recalculated.", results });
  } catch (error) {
    return errorResponse(error, "POST /api/admin/projects/[id]/final-marks");
  }
}
