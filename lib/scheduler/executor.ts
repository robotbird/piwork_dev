import "server-only";
import { getPreferredModelId } from "@/lib/ai/active-models";
import {
  buildExecutionSystemPrompt,
  ensureChatWorkspace,
  executionToolsEnabled,
} from "@/lib/ai/agent-tools";
import { loadEnabledManagedProjectSkills } from "@/lib/ai/managed-skills";
import { getPiModel } from "@/lib/ai/pi";
import { regularPrompt } from "@/lib/ai/prompts";
import { getUserModelCatalog } from "@/lib/ai/role-access";
import { buildSkillsSystemPrompt, createSkillTools } from "@/lib/ai/skills";
import {
  publishChatMessage,
  publishChatRun,
} from "@/lib/collab/chat-event-hub";
import { saveChat, saveMessages } from "@/lib/db/queries";
import {
  finishScheduledTask,
  linkTaskChat,
} from "@/lib/db/scheduled-task-queries";
import type { ScheduledTaskRecord } from "@/lib/db/schema";
import { syncManagedAgentMcpConfig } from "@/lib/mcp/agent-config";
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
    const modelId = getPreferredModelId(await getUserModelCatalog(task.userId));
    if (!modelId) {
      throw new Error("请先在管理后台配置可用模型");
    }
    const model = await getPiModel(modelId);
    const workspaceDir = executionToolsEnabled()
      ? await ensureChatWorkspace(chatId)
      : null;
    // MCP 服务配置同步不依赖工作区；失败仅记日志，不阻断任务执行
    await syncManagedAgentMcpConfig().catch((error) => {
      console.warn("Failed to sync managed agent mcp.json:", error);
    });
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
          userId: task.userId,
        },
      ],
    });
    // 协作实时：定时任务新对话首条用户消息落库后通知（房间通常为空，
    // 无 watcher 时广播为 no-op；与聊天路由同一语义）
    publishChatMessage({ actorId: task.userId, chatId, role: "user" });
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
        skills,
        systemPrompt: regularPrompt,
        tools: createSkillTools(skills),
        workspaceDir,
      },
      userId: task.userId,
    });
    publishChatRun({ actorId: task.userId, chatId, phase: "started" });
    await waitForTaskCompletion(handle);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "执行失败";
    await manager.abortByChat(chatId).catch(() => undefined);
  } finally {
    await finishScheduledTask(task, errorMessage);
  }
  return { error: errorMessage, success: !errorMessage, taskId: task.id };
}
