import { NextResponse } from "next/server";
import { authorize, errorResponse, parseId } from "@/lib/http";
import { getEvaluationSheet, saveEvaluation, saveEvaluationSchema } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/** GET /api/mentor/evaluations?project_id=&milestone_id= : marks sheet for this mentor */
export async function GET(request: Request) {
  const auth = await authorize(["Mentor"]);
  if (auth.response) return auth.response;
  try {
    const sp = new URL(request.url).searchParams;
    const sheet = await getEvaluationSheet(
      auth.session.userId,
      parseId(sp.get("project_id"), "project_id"),
      parseId(sp.get("milestone_id"), "milestone_id")
    );
    return NextResponse.json({ success: true, sheet });
  } catch (error) {
    return errorResponse(error, "GET /api/mentor/evaluations");
  }
}

/** PUT /api/mentor/evaluations : save comments + per-student marks */
export async function PUT(request: Request) {
  const auth = await authorize(["Mentor"]);
  if (auth.response) return auth.response;
  try {
    const input = saveEvaluationSchema.parse(await request.json());
    const evaluationId = await saveEvaluation(auth.session.userId, input);
    return NextResponse.json({
      success: true,
      message: "Evaluation saved and final marks recalculated.",
      evaluation_id: evaluationId,
    });
  } catch (error) {
    return errorResponse(error, "PUT /api/mentor/evaluations");
  }
}
