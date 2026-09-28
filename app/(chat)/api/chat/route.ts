import { geolocation } from "@vercel/functions";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { checkBotId } from "botid/server";
import { getTranslations } from "next-intl/server";
import { auth, type UserType } from "@/app/(auth)/auth";
import { getActiveModelCatalog } from "@/lib/ai/active-models";
import {
  buildExecutionSystemPrompt,
  ensureChatWorkspace,
  executionToolsEnabled,
  removeChatWorkspace,
  writeAttachmentsToWorkspace,
} from "@/lib/ai/agent-tools";
import { isChatFileUrl } from "@/lib/ai/attachment-types";
import {
  type PreparedChatAttachments,
  prepareChatAttachments,
} from "@/lib/ai/attachments";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { loadEnabledManagedProjectSkills } from "@/lib/ai/managed-skills";
import { getModelAvailability } from "@/lib/ai/models";
import { getPiModel, toPiHistoryMessages } from "@/lib/ai/pi";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { schedulingPrompt } from "@/lib/ai/scheduled-task-tools";
import {
  buildSkillsSystemPrompt,
  createSkillTools,
  invokeSkill,
  parseSkillCommand,
} from "@/lib/ai/skills";
import { canReadStoredFile } from "@/lib/db/library-queries";
import {
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { syncWorkspaceMcpConfig } from "@/lib/mcp/workspace-config";
import { getRunManager } from "@/lib/runtime/run";
import type { RunSubscription } from "@/lib/runtime/run/run-manager";
import { scheduledTaskTools } from "@/lib/scheduler/service";
import type { ChatMessage, WaitingStatusData } from "@/lib/types";
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";
import { pumpRunSubscription } from "./stream-mapping";

export const maxDuration = 60;

const HEALTH_CHECK_DELAY_MS = 9000;

export async function POST(request: Request) {
  const t = await getTranslations("api");
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const [botIdResult, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (botIdResult?.isBot) {
      return new ChatbotError("forbidden:api").toResponse();
    }

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    // 模型管理平台未配置任何模型时直接拒绝，不再回退静态模型
    const modelCatalog = await getActiveModelCatalog();
    if (modelCatalog.models.length === 0) {
      return Response.json({ error: t("noModelConfigured") }, { status: 503 });
    }
    const activeModelIds = new Set(
      modelCatalog.models.map((model) => model.id)
    );
    const fallbackModelId =
      modelCatalog.defaultModelId ?? modelCatalog.models[0].id;
    const chatModel = activeModelIds.has(selectedChatModel)
      ? selectedChatModel
      : fallbackModelId;

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      differenceInHours: 1,
      id: session.user.id,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        title: "New chat",
        userId: session.user.id,
        visibility: selectedVisibilityType,
      });
      const hasText = message.parts.some(
        (part) => part.type === "text" && part.text.trim()
      );
      titlePromise = hasText
        ? generateTitleFromUserMessage({ message })
        : Promise.resolve(
            message.parts[0]?.type === "file"
              ? (message.parts[0].filename ?? "附件处理")
              : "附件处理"
          );
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    // 审批续跑（v2.0 §2.1-8）：既有 assistant 消息的 parts（含审批状态
    // 覆盖）与 id 作为 run 的 base——RunManager 终态 upsert 前置合并，
    // 只落 run 事件 parts 会丢前轮内容/审批态。
    let baseAssistantMessageId: string | undefined;
    let baseParts: readonly unknown[] | undefined;
    if (isToolApprovalFlow) {
      const lastAssistant = uiMessages.findLast(
        (currentMessage) => currentMessage.role === "assistant"
      );
      if (lastAssistant) {
        baseAssistantMessageId = lastAssistant.id;
        baseParts = lastAssistant.parts;
      }
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      city,
      country,
      latitude,
      longitude,
    };

    if (message?.role === "user") {
      const fileAccess = await Promise.all(
        message.parts
          .filter((part) => part.type === "file" && isChatFileUrl(part.url))
          .map((part) =>
            part.type === "file"
              ? canReadStoredFile(session.user.id, part.url)
              : true
          )
      );
      if (fileAccess.some((allowed) => !allowed)) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      await saveMessages({
        messages: [
          {
            attachments: [],
            chatId: id,
            createdAt: new Date(),
            id: message.id,
            parts: message.parts,
            role: "user",
          },
        ],
      });
    }

    const modelConfig = modelCatalog.models.find((m) => m.id === chatModel);
    const currentUserMessageIndex = uiMessages.findLastIndex(
      (currentMessage) => currentMessage.role === "user"
    );
    const currentUserMessage = uiMessages[currentUserMessageIndex];
    const currentUserText = currentUserMessage
      ? getTextFromMessage(currentUserMessage).trim()
      : "";

    const currentUserFileCount =
      currentUserMessage?.parts.filter((part) => part.type === "file").length ??
      0;
    if (!(currentUserText || currentUserFileCount > 0)) {
      return new ChatbotError("bad_request:api").toResponse();
    }

    let preparedAttachments: PreparedChatAttachments;
    try {
      preparedAttachments = currentUserMessage
        ? await prepareChatAttachments(currentUserMessage, request.signal)
        : { images: [], text: "" };
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to process attachments.",
        },
        { status: 400 }
      );
    }
    const piModel = await getPiModel(chatModel);
    if (
      preparedAttachments.images.length > 0 &&
      !piModel.input.includes("image")
    ) {
      return Response.json({ error: t("modelNoImages") }, { status: 400 });
    }

    const { skills, diagnostics: skillDiagnostics } =
      await loadEnabledManagedProjectSkills();
    if (skillDiagnostics.length > 0) {
      console.warn("Skill discovery warnings:", skillDiagnostics);
    }

    // 执行类工具（bash/read/write/edit + deliver_file）以每聊天独立工作区
    // 运行；用户上传的附件原始字节先落盘到工作区供 skill 脚本直接读取。
    const workspaceDir = executionToolsEnabled()
      ? await ensureChatWorkspace(id)
      : null;
    if (workspaceDir) {
      // 管理端 MCP 服务配置同步进工作区 .mcp.json（pi 官方发现格式）；
      // 幂等（内容未变不写盘），失败仅记日志不阻断聊天。
      await syncWorkspaceMcpConfig(workspaceDir).catch((error) => {
        console.warn("Failed to sync workspace .mcp.json:", error);
      });
    }
    let workspaceAttachmentFiles: string[] = [];
    if (workspaceDir && currentUserMessage) {
      try {
        workspaceAttachmentFiles = await writeAttachmentsToWorkspace(
          currentUserMessage,
          workspaceDir,
          request.signal
        );
      } catch (error) {
        console.warn(
          "Failed to materialize attachments into workspace:",
          error
        );
      }
    }

    const baseSystemPrompt = systemPrompt({
      requestHints,
      supportsTools: false,
    });
    const executionPrompt = workspaceDir
      ? buildExecutionSystemPrompt(workspaceDir, workspaceAttachmentFiles)
      : "";
    const historyMessages = toPiHistoryMessages(
      uiMessages.slice(0, currentUserMessageIndex),
      chatModel
    );
    const skillCommand = parseSkillCommand(currentUserText);

    let agentPrompt = currentUserText || "请分析并处理附件。";
    if (skillCommand) {
      try {
        agentPrompt = invokeSkill(
          skills,
          skillCommand.name,
          skillCommand.instructions
        );
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown skill" },
          { status: 404 }
        );
      }
    }
    if (preparedAttachments.text) {
      agentPrompt = `${agentPrompt}\n\n${preparedAttachments.text}`;
    }

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const modelName = modelConfig?.name ?? chatModel;
        let hasModelActivity = false;
        let healthCheckTimer: ReturnType<typeof setTimeout> | undefined;

        const clearHealthCheckTimer = () => {
          if (healthCheckTimer) {
            clearTimeout(healthCheckTimer);
          }
        };

        const writeWaitingStatus = (
          phase: WaitingStatusData["phase"],
          messageText: string
        ) => {
          if (hasModelActivity && phase !== "thinking") {
            return;
          }
          dataStream.write({
            data: {
              message: messageText,
              modelId: chatModel,
              modelName,
              phase,
            },
            transient: true,
            type: "data-waiting-status",
          });
        };

        writeWaitingStatus("waiting", "Waiting...");

        healthCheckTimer = setTimeout(() => {
          Promise.resolve(getModelAvailability(chatModel))
            .then((availability) => {
              if (availability === "impacted") {
                writeWaitingStatus(
                  "health",
                  `${modelName} may be slow or unavailable right now...`
                );
              } else {
                writeWaitingStatus("still-waiting", "Still waiting...");
              }
            })
            .catch(() => {
              writeWaitingStatus("still-waiting", "Still waiting...");
            });
        }, HEALTH_CHECK_DELAY_MS);

        const markModelActive = () => {
          if (hasModelActivity) {
            return;
          }
          hasModelActivity = true;
          clearHealthCheckTimer();
          writeWaitingStatus("thinking", "Thinking...");
        };

        const stopWaitingStatus = () => {
          hasModelActivity = true;
          clearHealthCheckTimer();
        };

        // RunManager（v2.0 Step 2）：run 生命周期独立于本请求——start 落
        // AgentRun/lease 并启动唯一消费循环，route 只 attach 订阅；断线仅
        // detach（run 进程内继续），消息在终态由 RunManager 幂等 upsert。
        let subscription: RunSubscription | undefined;
        try {
          const run = await getRunManager().start({
            baseAssistantMessageId,
            baseParts,
            prompt: {
              // expandPromptTemplates:false——技能命令已在上方自行展开,
              // 否则用户消息以 /mcp 等开头会派发扩展命令
              expandPromptTemplates: false,
              images: preparedAttachments.images,
              text: agentPrompt,
              type: "prompt",
            },
            spec: {
              appendSystemPrompt: [
                buildSkillsSystemPrompt(skills),
                schedulingPrompt + new Date().toISOString(),
                ...(executionPrompt ? [executionPrompt] : []),
              ],
              chatId: id,
              historyMessages,
              model: piModel,
              systemPrompt: baseSystemPrompt,
              tools: [
                ...createSkillTools(skills),
                ...scheduledTaskTools(session.user.id, currentUserMessage.id),
              ],
              workspaceDir,
            },
            userId: session.user.id,
          });

          const attached = run.attach();
          if (!attached) {
            // start 返回后 LiveRun 必在，仅防御性兜底
            throw new Error("run detached before attach");
          }
          subscription = attached;
          // 显式 start：客户端/DB/重放共用同一确定性消息 id（§2.5）
          dataStream.write({ messageId: attached.messageId, type: "start" });

          const detach = () => subscription?.close();
          request.signal.addEventListener("abort", detach, { once: true });
          try {
            await pumpRunSubscription(dataStream, subscription, {
              // 任意内容块事件即视为模型活跃(含 tool 通道,与原事件桥一致)
              onEvent: (event) => {
                if (event.type === "message.delta") {
                  markModelActive();
                }
              },
            });
          } finally {
            request.signal.removeEventListener("abort", detach);
          }
        } finally {
          stopWaitingStatus();
          subscription?.close();
        }

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ data: title, type: "data-chat-title" });
            updateChatTitleById({ chatId: id, title });
          } catch {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onError: () => t("modelUnavailable"),
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  // 先停活跃 run 再删（best-effort）：避免删除后 run 继续向已删 chat 落消息
  await getRunManager()
    .abortByChat(id)
    .catch(() => undefined);

  const deletedChat = await deleteChatById({ id });

  // 聊天删除后同步清理其执行工作区（best-effort）。
  await removeChatWorkspace(id).catch(() => undefined);

  return Response.json(deletedChat, { status: 200 });
}
