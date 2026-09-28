/** API route: trigger scheduled tasks (called by cron job or manually) */

import { NextRequest, NextResponse } from "next/server";
import { processDueTasks } from "@/lib/scheduler/scheduler";

/**
 * This endpoint is called periodically to check and execute due tasks
 * Can be triggered by:
 * - Vercel Cron Jobs
 * - External cron service
 * - Manual call for testing
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authorization (simple API key check for now)
    const authHeader = req.headers.get("authorization");
    const apiKey = process.env.SCHEDULED_TASKS_API_KEY;

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await processDueTasks();

    return NextResponse.json({
      success: true,
      results: results.map((r, i) => ({
        index: i,
        status: r.status,
        reason: r.reason || undefined,
      })),
    });
  } catch (error) {
    console.error("Process due tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
