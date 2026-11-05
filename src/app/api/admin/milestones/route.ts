import { NextResponse } from "next/server";
import { authorize, errorResponse } from "@/lib/http";
import { createMilestone, listMilestones, milestoneSchema } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/** GET /api/admin/milestones?academic_year=2026-2027 */
export async function GET(request: Request) {
  const auth = await authorize(["Admin", "Coordinator"]);
  if (auth.response) return auth.response;
  try {
    const year = new URL(request.url).searchParams.get("academic_year") || undefined;
    return NextResponse.json({ success: true, milestones: await listMilestones(year) });
  } catch (error) {
    return errorResponse(error, "GET /api/admin/milestones");
  }
}

/** POST /api/admin/milestones */
export async function POST(request: Request) {
  const auth = await authorize(["Admin", "Coordinator"]);
  if (auth.response) return auth.response;
  try {
    const input = milestoneSchema.parse(await request.json());
    const id = await createMilestone(input, auth.session.userId);
    return NextResponse.json({ success: true, message: "Milestone created.", milestone_id: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "POST /api/admin/milestones");
  }
}
