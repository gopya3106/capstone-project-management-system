import { NextResponse } from "next/server";
import { authorize, errorResponse, parseId } from "@/lib/http";
import { deleteMilestone, milestoneUpdateSchema, updateMilestone } from "@/lib/workflow";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/milestones/[id] */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorize(["Admin", "Coordinator"]);
  if (auth.response) return auth.response;
  try {
    const id = parseId((await context.params).id, "Milestone ID");
    await updateMilestone(id, milestoneUpdateSchema.parse(await request.json()));
    return NextResponse.json({ success: true, message: "Milestone updated." });
  } catch (error) {
    return errorResponse(error, "PATCH /api/admin/milestones/[id]");
  }
}

/** DELETE /api/admin/milestones/[id] (only when nothing references it) */
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await authorize(["Admin", "Coordinator"]);
  if (auth.response) return auth.response;
  try {
    const id = parseId((await context.params).id, "Milestone ID");
    await deleteMilestone(id);
    return NextResponse.json({ success: true, message: "Milestone deleted." });
  } catch (error) {
    return errorResponse(error, "DELETE /api/admin/milestones/[id]");
  }
}
