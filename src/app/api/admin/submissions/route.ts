import { NextResponse } from "next/server";
import { authorize, errorResponse } from "@/lib/http";
import { listSubmissions, SUBMISSION_STATUSES, SubmissionStatus } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/** GET /api/admin/submissions?status=&late=1&milestone_id= */
export async function GET(request: Request) {
  const auth = await authorize(["Admin", "Coordinator"]);
  if (auth.response) return auth.response;
  try {
    const sp = new URL(request.url).searchParams;
    const status = sp.get("status");
    const milestoneId = Number(sp.get("milestone_id"));
    const submissions = await listSubmissions({
      status: (SUBMISSION_STATUSES as readonly string[]).includes(status || "") ? (status as SubmissionStatus) : undefined,
      lateOnly: sp.get("late") === "1",
      milestoneId: Number.isInteger(milestoneId) && milestoneId > 0 ? milestoneId : undefined,
    });
    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    return errorResponse(error, "GET /api/admin/submissions");
  }
}
