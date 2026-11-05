import { NextResponse } from "next/server";
import { authorize, errorResponse } from "@/lib/http";
import { submitDocument, submitDocumentSchema } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/** POST /api/student/submissions : submit a milestone document (link). */
export async function POST(request: Request) {
  const auth = await authorize(["Student"]);
  if (auth.response) return auth.response;
  try {
    const input = submitDocumentSchema.parse(await request.json());
    const submission = await submitDocument(auth.session.userId, input);
    return NextResponse.json(
      {
        success: true,
        message: submission.is_late
          ? `Submitted as version ${submission.version_no}. Note: this is after the due date and is marked late.`
          : `Submitted as version ${submission.version_no}.`,
        submission,
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error, "POST /api/student/submissions");
  }
}
