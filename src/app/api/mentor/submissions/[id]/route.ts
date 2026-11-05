import { NextResponse } from "next/server";
import { authorize, errorResponse, parseId } from "@/lib/http";
import { reviewSubmission, reviewSubmissionSchema } from "@/lib/workflow";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/mentor/submissions/[id] : { submission_status, feedback } */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorize(["Mentor"]);
  if (auth.response) return auth.response;
  try {
    const id = parseId((await context.params).id, "Submission ID");
    const input = reviewSubmissionSchema.parse(await request.json());
    await reviewSubmission(auth.session.userId, id, input);
    return NextResponse.json({ success: true, message: `Submission marked ${input.submission_status}.` });
  } catch (error) {
    return errorResponse(error, "PATCH /api/mentor/submissions/[id]");
  }
}
