import { NextResponse } from "next/server";
import { getMongoDb, isMongoConfigured } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * Diagnostic health-check endpoint for MongoDB Atlas connectivity.
 *
 * Designed for local development and verification.
 * Strictly restricted in production environments to avoid leaking infrastructure telemetry.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        success: false,
        message: "This diagnostic health-check endpoint is disabled in production.",
      },
      { status: 403 }
    );
  }

  if (!isMongoConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "MongoDB is not configured (MONGODB_URI is not set). History features are disabled.",
      },
      { status: 503 }
    );
  }

  try {
    const db = await getMongoDb();
    const pingResult = await db.command({ ping: 1 });

    if (pingResult.ok !== 1) {
      throw new Error("Ping command did not return success code.");
    }

    return NextResponse.json({
      success: true,
      message: "MongoDB Atlas connection successfully established.",
      database: db.databaseName,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    // Log only safe diagnostic category/name on the server - never expose URIs, secrets, or raw stacks
    const errorType = error instanceof Error ? error.name : "UnknownError";
    const errorCode = (error as { code?: string | number })?.code;
    console.error(
      `[MongoDB Health Check Error] Ping failed. Category: ${errorType}, Code: ${errorCode ?? "N/A"}`
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to connect to MongoDB Atlas. Verify cluster status, network access whitelist, and credentials in .env.local.",
        error: errorType,
      },
      { status: 500 }
    );
  }
}

