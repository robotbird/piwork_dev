import { timingSafeEqual } from "node:crypto";
import { taskApiError } from "@/lib/scheduler/http";
import { processDueTasks } from "@/lib/scheduler/scheduler";
export const maxDuration = 360;

export async function POST(request: Request) {
  const key = process.env.SCHEDULED_TASKS_API_KEY;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${key ?? ""}`);
  if (
    !key ||
    given.length !== expected.length ||
    !timingSafeEqual(given, expected)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json({ results: await processDueTasks() });
  } catch (error) {
    return taskApiError(error);
  }
}
