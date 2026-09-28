import "server-only";
import {
  getActiveModelCatalog,
  getPreferredModelId,
} from "@/lib/ai/active-models";
import {
  buildExecutionSystemPrompt,
  ensureChatWorkspace,
  executionToolsEnabled,
} from "@/lib/ai/agent-tools";
import { loadEnabledManagedProjectSkills } from "@/lib/ai/managed-skills";
import { getPiModel } from "@/lib/ai/pi";
import { regularPrompt } from "@/lib/ai/prompts";
import { buildSkillsSystemPrompt, createSkillTools } from "@/lib/ai/skills";
import { saveChat, saveMessages } from "@/lib/db/queries";
import {
  finishScheduledTask,
  linkTaskChat,
} from "@/lib/db/scheduled-task-queries";
import type { ScheduledTaskRecord } from "@/lib/db/schema";
import { syncWorkspaceMcpConfig } from "@/lib/mcp/workspace-config";
import { getRunManager } from "@/lib/runtime/run";
import { waitForTaskCompletion } from "./completion";

/** Accept only atomically claimed tasks. The scheduler never implements an agent loop. */
export async function executeScheduledTask(task: ScheduledTaskRecord) {
  if (!task.leaseToken) {
    throw new Error("Task must be claimed before execution");
  }
  const chatId = crypto.randomUUID();
  let errorMessage: string | null = null;
  const manager = getRunManager();
  try {
    const modelId = getPreferredModelId(await getActiveModelCatalog());
    if (!modelId) {
      throw new Error("请先在管理后台配置可用模型");
    }
    const model = await getPiModel(modelId);
    const workspaceDir = executionToolsEnabled()
      ? await ensureChatWorkspace(chatId)
      : null;
    if (workspaceDir) {
      await syncWorkspaceMcpConfig(workspaceDir);
    }
    const { skills } = await loadEnabledManagedProjectSkills();
    await saveChat({
      id: chatId,
      title: `[任务] ${task.taskType}`,
      userId: task.userId,
      visibility: "private",
    });
    await linkTaskChat(task, chatId);
    await saveMessages({
      messages: [
        {
          attachments: [],
          chatId,
          createdAt: new Date(),
          id: crypto.randomUUID(),
          parts: [{ text: task.prompt, type: "text" }],
          role: "user",
        },
      ],
    });
    const handle = await manager.start({
      prompt: { text: task.prompt, type: "prompt" },
      spec: {
        appendSystemPrompt: [
          buildSkillsSystemPrompt(skills),
          ...(workspaceDir
            ? [buildExecutionSystemPrompt(workspaceDir, [])]
            : []),
          `这是定时执行的任务。当前时间 ${new Date().toISOString()}。直接完成工作，不要创建新的定时任务。无法获取所需信息时如实说明，不编造实时信息或声称已发送通知。`,
        ],
        chatId,
        historyMessages: [],
        model,
        systemPrompt: regularPrompt,
        tools: createSkillTools(skills),
        workspaceDir,
      },
      userId: task.userId,
    });
    await waitForTaskCompletion(handle);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "执行失败";
    await manager.abortByChat(chatId).catch(() => undefined);
  } finally {
    await finishScheduledTask(task, errorMessage);
  }
  return { error: errorMessage, success: !errorMessage, taskId: task.id };
}
