import { getCurrentUser } from "@/lib/auth/session";
import {
  createScheduledTask,
  listScheduledTasks,
} from "@/lib/db/scheduled-task-queries";
import { taskApiError } from "@/lib/scheduler/http";
import { taskInputSchema } from "@/lib/scheduler/validation";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    return Response.json(await listScheduledTasks(user.id));
  } catch (error) {
    return taskApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    const input = taskInputSchema.parse(await request.json());
    return Response.json(await createScheduledTask(user.id, input), {
      status: 201,
    });
  } catch (error) {
    return taskApiError(error);
  }
}
