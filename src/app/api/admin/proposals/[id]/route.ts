import { NextResponse } from "next/server";
import { authorize, errorResponse, parseId } from "@/lib/http";
import { reviewProposal, reviewProposalSchema } from "@/lib/workflow";
import { actorRoleFor, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/proposals/[id] : { decision, comments } via sp_review_proposal */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authorize(["Admin", "Coordinator"]);
  if (auth.response) return auth.response;
  try {
    const proposalId = parseId((await context.params).id, "Proposal ID");
    const input = reviewProposalSchema.parse(await request.json());
    const result = await reviewProposal(proposalId, auth.session.userId, input);
    if (result.project_id) {
      await recordActivity({
        projectId: result.project_id,
        actorId: auth.session.userId,
        actorRole: actorRoleFor(auth.session.role),
        action: "PROPOSAL_REVIEWED",
        description: `Proposal #${proposalId} marked ${input.decision}.`,
        metadata: { proposalId, comments: input.comments },
      });
    }
    return NextResponse.json({
      success: true,
      message: `Proposal marked ${input.decision}.`,
      project_id: result.project_id,
    });
  } catch (error) {
    return errorResponse(error, "PATCH /api/admin/proposals/[id]");
  }
}
