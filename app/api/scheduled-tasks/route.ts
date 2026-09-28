/** API route: create scheduled task */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createScheduledTask } from "@/lib/db/scheduled-task-queries";
import { parseCron, getNextRunTime } from "@/lib/scheduler/cron-utils";
import { saveChat } from "@/lib/db/queries";

interface CreateTaskRequest {
  taskType: string;
  prompt: string;
  schedule: {
    cron: string;
    timezone?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateTaskRequest = await req.json();

    // Validate cron expression
    const cronValidation = parseCron(body.schedule.cron);
    if (!cronValidation.isValid) {
      return NextResponse.json(
        { error: `Invalid cron expression: ${cronValidation.error}` },
        { status: 400 }
      );
    }

    // Create a chat for this task
    const chat = await saveChat({
      id: crypto.randomUUID(),
      title: `[任务] ${body.taskType}`,
      userId: user.id,
      visibility: "private",
    });

    // Calculate next run time
    const nextRunAt = getNextRunTime(body.schedule.cron, new Date());

    // Create the task
    const task = await createScheduledTask({
      userId: user.id,
      chatId: chat.id,
      taskType: body.taskType,
      prompt: body.prompt,
      schedule: body.schedule,
      status: "pending",
      nextRunAt,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Create scheduled task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { listScheduledTasks } = await import("@/lib/db/scheduled-task-queries");
    const tasks = await listScheduledTasks(user.id);

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("List scheduled tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
