import { NextResponse } from "next/server";
import { authorize, errorResponse } from "@/lib/http";
import { listProposals, getProposalStats, PROPOSAL_STATUSES, ProposalStatus } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/** GET /api/admin/proposals?status=Pending|Submitted|Under Review|Approved|Rejected */
export async function GET(request: Request) {
  const auth = await authorize(["Admin", "Coordinator"]);
  if (auth.response) return auth.response;
  try {
    const status = new URL(request.url).searchParams.get("status") || undefined;
    const valid = status === "Pending" || (PROPOSAL_STATUSES as readonly string[]).includes(status || "");
    const [proposals, stats] = await Promise.all([
      listProposals(valid ? (status as ProposalStatus | "Pending") : undefined),
      getProposalStats(),
    ]);
    return NextResponse.json({ success: true, proposals, stats });
  } catch (error) {
    return errorResponse(error, "GET /api/admin/proposals");
  }
}
