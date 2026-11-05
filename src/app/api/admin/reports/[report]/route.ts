import { NextResponse } from "next/server";
import { authorize, errorResponse } from "@/lib/http";
import { isReportKey, runReport, toCsv, REPORTS } from "@/lib/workflow";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ report: string }> };

/** GET /api/admin/reports/[report]?format=csv */
export async function GET(request: Request, context: RouteContext) {
  const auth = await authorize(["Admin", "Coordinator"]);
  if (auth.response) return auth.response;
  try {
    const { report } = await context.params;
    if (!isReportKey(report)) {
      return NextResponse.json(
        { success: false, message: `Unknown report. Available: ${Object.keys(REPORTS).join(", ")}.` },
        { status: 404 }
      );
    }
    const rows = await runReport(report);
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const date = new Date().toISOString().slice(0, 10);
      return new NextResponse(toCsv(report, rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="cpms-${report}-${date}.csv"`,
        },
      });
    }
    return NextResponse.json({ success: true, title: REPORTS[report].title, rows });
  } catch (error) {
    return errorResponse(error, "GET /api/admin/reports/[report]");
  }
}
