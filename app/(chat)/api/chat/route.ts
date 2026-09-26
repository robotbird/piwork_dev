import { geolocation, ipAddress } from "@vercel/functions";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { getActiveModelCatalog } from "@/lib/ai/active-models";
import {
  buildExecutionSystemPrompt,
  ensureChatWorkspace,
  executionToolsEnabled,
  removeChatWorkspace,
  writeAttachmentsToWorkspace,
} from "@/lib/ai/agent-tools";
import {
  type PreparedChatAttachments,
  prepareChatAttachments,
} from "@/lib/ai/attachments";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { loadEnabledManagedProjectSkills } from "@/lib/ai/managed-skills";
import { getModelAvailability } from "@/lib/ai/models";
import { getPiModel, toPiHistoryMessages } from "@/lib/ai/pi";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import {
  buildSkillsSystemPrompt,
  createSkillTools,
  invokeSkill,
  parseSkillCommand,
} from "@/lib/ai/skills";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { syncWorkspaceMcpConfig } from "@/lib/mcp/workspace-config";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { RuntimeSession } from "@/lib/runtime";
import { getRuntimeBackend } from "@/lib/runtime";
import type { ChatMessage, WaitingStatusData } from "@/lib/types";
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";
import { runtimeEventToUIMessageChunks } from "./stream-mapping";

export const maxDuration = 60;

const HEALTH_CHECK_DELAY_MS = 9000;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch {
    return null;
  }
}

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

    await checkIpRateLimit(ipAddress(request));

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

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      city,
      country,
      latitude,
      longitude,
    };

    if (message?.role === "user") {
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

        // 提升到 try 外:finally 里要无条件释放(构建中途抛错也安全)
        let runtimeSession: RuntimeSession | undefined;
        try {
          // Runtime seam(v2.0 Step 1):pi 会话构建与事件归一化收进 backend,
          // route 只做事件→stream chunk 翻译;deliver_file 的交付闭包也由
          // backend 注入(artifact.created 事件,非 transient,随 onEnd 持久化)
          runtimeSession = await getRuntimeBackend().open({
            appendSystemPrompt: [
              buildSkillsSystemPrompt(skills),
              ...(executionPrompt ? [executionPrompt] : []),
            ],
            chatId: id,
            historyMessages,
            model: piModel,
            systemPrompt: baseSystemPrompt,
            tools: createSkillTools(skills),
            workspaceDir,
          });

          const abortAgent = () => {
            runtimeSession?.send({ type: "abort" }).catch(() => undefined);
          };
          request.signal.addEventListener("abort", abortAgent, { once: true });
          try {
            const ack = await runtimeSession.send({
              // expandPromptTemplates:false——技能命令已在上方自行展开,
              // 否则用户消息以 /mcp 等开头会派发扩展命令
              expandPromptTemplates: false,
              images: preparedAttachments.images,
              text: agentPrompt,
              type: "prompt",
            });
            if (!ack.ok) {
              throw new Error(ack.error);
            }
            for await (const event of runtimeSession.events()) {
              // 任意内容块事件即视为模型活跃(含 tool 通道,与原事件桥一致)
              if (event.type === "message.delta") {
                markModelActive();
              }
              for (const chunk of runtimeEventToUIMessageChunks(event)) {
                dataStream.write(chunk);
              }
              if (event.type === "run.settled") {
                break;
              }
              // 与原实现等价:aborted 场景由 backend 归一为 run.settled
              if (event.type === "run.failed") {
                throw new Error(event.error);
              }
            }
          } finally {
            request.signal.removeEventListener("abort", abortAgent);
          }
        } finally {
          stopWaitingStatus();
          await runtimeSession
            ?.close("request-finished")
            .catch(() => undefined);
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
      onEnd: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          await Promise.all(
            finishedMessages.map(async (finishedMsg) => {
              const existingMsg = uiMessages.find(
                (m) => m.id === finishedMsg.id
              );
              if (existingMsg) {
                await updateMessage({
                  id: finishedMsg.id,
                  parts: finishedMsg.parts,
                });
                return;
              }

              await saveMessages({
                messages: [
                  {
                    attachments: [],
                    chatId: id,
                    createdAt: new Date(),
                    id: finishedMsg.id,
                    parts: finishedMsg.parts,
                    role: finishedMsg.role,
                  },
                ],
              });
            })
          );
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              attachments: [],
              chatId: id,
              createdAt: new Date(),
              id: currentMessage.id,
              parts: currentMessage.parts,
              role: currentMessage.role,
            })),
          });
        }
      },
      onError: () => t("modelUnavailable"),
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
    });

    return createUIMessageStreamResponse({
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ chatId: id, streamId });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch {
          /* non-critical */
        }
      },
      stream,
    });
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

  const deletedChat = await deleteChatById({ id });

  // 聊天删除后同步清理其执行工作区（best-effort）。
  await removeChatWorkspace(id).catch(() => undefined);

  return Response.json(deletedChat, { status: 200 });
}
