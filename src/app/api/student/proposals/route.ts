import { NextResponse } from "next/server";
import { authorize, errorResponse } from "@/lib/http";
import { submitProposal, submitProposalSchema } from "@/lib/workflow";
import { recordActivity } from "@/lib/activity";
import { getStudentContext } from "@/lib/workflow/context";

export const dynamic = "force-dynamic";

/** POST /api/student/proposals : submit a proposal for the student's group. */
export async function POST(request: Request) {
  const auth = await authorize(["Student"]);
  if (auth.response) return auth.response;
  try {
    const input = submitProposalSchema.parse(await request.json());
    const proposalId = await submitProposal(auth.session.userId, input);
    const ctx = await getStudentContext(auth.session.userId);
    if (ctx.project_id) {
      await recordActivity({
        projectId: ctx.project_id,
        actorId: auth.session.userId,
        actorRole: "student",
        action: "PROPOSAL_SUBMITTED",
        description: `${ctx.full_name} submitted proposal "${input.title}".`,
        metadata: { proposalId },
      });
    }
    return NextResponse.json(
      { success: true, message: "Proposal submitted for review.", proposal_id: proposalId },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error, "POST /api/student/proposals");
  }
}
