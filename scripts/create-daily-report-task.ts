/** 创建每日 AI 日报任务脚本
 *
 * 用法：pnpm tsx scripts/create-daily-report-task.ts
 *
 * 此脚本会在数据库中创建一个定时任务：
 * - 每天早上 9 点执行
 * - 生成前一天对话的摘要报告
 * - 通过用户配置的通知渠道发送
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { scheduledTask, user } from "../lib/db/schema";
import { eq } from "drizzle-orm";

// 数据库配置
const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

interface DailyReportTaskConfig {
  /** 用户 ID - 如果是多用户系统，可以遍历所有用户创建 */
  userId?: string;
  /** 时区配置 */
  timezone?: string;
}

async function createDailyReportTask(config: DailyReportTaskConfig = {}) {
  const {
    userId,
    timezone = "Asia/Shanghai",
  } = config;

  try {
    console.log("开始创建每日 AI 日报任务...");

    // 如果未指定用户，获取第一个用户（对于单用户系统是默认用户）
    let targetUserId = userId;
    if (!targetUserId) {
      const users = await db.select({ id: user.id }).from(user).limit(1);
      if (users.length === 0) {
        throw new Error("未找到任何用户，请先创建用户账户");
      }
      targetUserId = users[0].id;
      console.log(`使用默认用户：${targetUserId}`);
    }

    // 检查是否已存在每日日报任务
    const existingTasks = await db
      .select()
      .from(scheduledTask)
      .where(
        eq(scheduledTask.taskType, "daily_digest")
      );

    const filteredTasks = existingTasks.filter(task => task.userId === targetUserId);

    if (filteredTasks.length > 0) {
      console.log(`用户 ${targetUserId} 已存在每日日报任务：`);
      for (const task of filteredTasks) {
        console.log(`  - 任务 ID: ${task.id}, 状态：${task.status}, CRON: ${(task.schedule as any).cron}`);
      }
      console.log("跳过创建，如需重新创建请先删除现有任务");
      return;
    }

    // 创建日报任务的提示词
    const dailyReportPrompt = `你是一位专业的 AI 助手，负责生成每日工作摘要报告。

请根据以下信息生成一份简洁、有用的日报：

【任务目标】
总结过去 24 小时内的对话记录和完成的工作。

【报告结构】
1. 今日概览（完成的主要任务数量、对话时长等）
2. 重要成果（关键发现、完成的代码、解决的问题）
3. 待办事项（未完成的任务、需要跟进的问题）
4. 明日建议（基于当前进度的下一步行动）

【写作要求】
- 使用清晰的 Markdown 格式
- 重点突出，避免冗长
- 使用中文撰写
- 包含具体的时间戳和数据

如果没有新的对话记录，请如实报告"今日无对话活动"。`;

    // CRON 表达式：每天早上 9 点（北京时间）
    const cronExpression = "0 9 * * *";

    // 创建聊天会话用于存储日报
    const chatId = crypto.randomUUID();
    const chatTitle = "[自动任务] 每日 AI 日报";

    await db.insert(require("../lib/db/schema").chat).values({
      id: chatId,
      userId: targetUserId,
      title: chatTitle,
      visibility: "private",
      createdAt: new Date(),
    });

    // 创建定时任务
    const taskId = crypto.randomUUID();
    const nextRunAt = calculateNextRun(cronExpression);

    await db.insert(scheduledTask).values({
      id: taskId,
      userId: targetUserId,
      chatId: chatId,
      taskType: "daily_digest",
      prompt: dailyReportPrompt,
      schedule: {
        cron: cronExpression,
        timezone: timezone,
      },
      status: "pending",
      nextRunAt: nextRunAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("\n✅ 每日 AI 日报任务创建成功！");
    console.log(`   任务 ID: ${taskId}`);
    console.log(`   用户 ID: ${targetUserId}`);
    console.log(`   执行时间：每天上午 9:00 (${timezone})`);
    console.log(`   下次执行：${nextRunAt.toISOString()}`);
    console.log(`   状态：pending（等待调度器激活）`);
    console.log("\n提示：需要在服务器端运行调度器来触发任务执行");
    console.log("示例：node scripts/run-scheduler.js");

  } catch (error) {
    console.error("❌ 创建任务失败:", error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * 计算下一次运行时间（简化版，仅用于初始化）
 * 对于生产环境，请使用 lib/scheduler/cron-utils.ts 中的 getNextRunTime
 */
function calculateNextRun(cron: string): Date {
  const parts = cron.split(" ");
  const [minute, hour] = parts;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(parseInt(hour), parseInt(minute), 0, 0);

  return tomorrow;
}

// 如果直接运行此脚本
if (require.main === module) {
  createDailyReportTask()
    .then(() => {
      console.log("\n脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n脚本执行失败:", error);
      process.exit(1);
    });
}

export { createDailyReportTask };
