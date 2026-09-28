import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  claimScheduledTask,
  deleteScheduledTask,
  editScheduledTask,
  getScheduledTask,
  listTaskRuns,
  setTaskEnabled,
} from "@/lib/db/scheduled-task-queries";
import { executeScheduledTask } from "@/lib/scheduler/executor";
import { taskApiError } from "@/lib/scheduler/http";
import { taskInputSchema } from "@/lib/scheduler/validation";

export const maxDuration = 360;
type Context = { params: Promise<{ id: string }> };
const missing = () => Response.json({ error: "任务不存在" }, { status: 404 });
const conflict = () =>
  Response.json({ error: "任务正在运行，请结束后重试" }, { status: 409 });

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    const id = z.uuid().parse((await params).id);
    const task = await getScheduledTask(user.id, id);
    if (!task) {
      return missing();
    }
    return Response.json({ runs: await listTaskRuns(user.id, id), task });
  } catch (error) {
    return taskApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    const id = z.uuid().parse((await params).id);
    const input = taskInputSchema.parse(await request.json());
    if (!(await getScheduledTask(user.id, id))) {
      return missing();
    }
    const task = await editScheduledTask(user.id, id, input);
    return task ? Response.json(task) : conflict();
  } catch (error) {
    return taskApiError(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    const id = z.uuid().parse((await params).id);
    const { action } = z
      .object({ action: z.enum(["pause", "resume", "run"]) })
      .strict()
      .parse(await request.json());
    if (!(await getScheduledTask(user.id, id))) {
      return missing();
    }
    if (action === "run") {
      const task = await claimScheduledTask(user.id, id, true);
      if (!task) {
        return conflict();
      }
      after(() => executeScheduledTask(task).then(() => undefined));
      return Response.json(task, { status: 202 });
    }
    const task = await setTaskEnabled(user.id, id, action === "resume");
    return task ? Response.json(task) : missing();
  } catch (error) {
    return taskApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    const id = z.uuid().parse((await params).id);
    if (!(await getScheduledTask(user.id, id))) {
      return missing();
    }
    return (await deleteScheduledTask(user.id, id))
      ? Response.json({ success: true })
      : conflict();
  } catch (error) {
    return taskApiError(error);
  }
}
