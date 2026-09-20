import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { geolocation, ipAddress } from "@vercel/functions";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import {
  buildExecutionSystemPrompt,
  createDeliverFileTool,
  createExecutionTools,
  ensureChatWorkspace,
  executionToolsEnabled,
  formatToolStatus,
  removeChatWorkspace,
  writeAttachmentsToWorkspace,
} from "@/lib/ai/agent-tools";
import {
  type PreparedChatAttachments,
  prepareChatAttachments,
} from "@/lib/ai/attachments";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { loadEnabledManagedProjectSkills } from "@/lib/ai/managed-skills";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getModelAvailability,
} from "@/lib/ai/models";
import { getPiModel, streamPiAgent, toPiContext } from "@/lib/ai/pi";
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
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage, WaitingStatusData } from "@/lib/types";
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

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

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

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

    const modelConfig = chatModels.find((m) => m.id === chatModel);
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
    const piModel = getPiModel(chatModel);
    if (
      preparedAttachments.images.length > 0 &&
      !piModel.input.includes("image")
    ) {
      return Response.json(
        { error: "当前模型不支持图片，请切换到 DeepSeek Flash。" },
        { status: 400 }
      );
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
    const execution = workspaceDir ? createExecutionTools(workspaceDir) : null;
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
      ? `\n\n${buildExecutionSystemPrompt(workspaceDir, workspaceAttachmentFiles)}`
      : "";
    const agentSystemPrompt = `${baseSystemPrompt}\n\n${buildSkillsSystemPrompt(skills)}${executionPrompt}`;
    const previousPiContext = toPiContext(
      uiMessages.slice(0, currentUserMessageIndex),
      chatModel,
      agentSystemPrompt
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

        try {
          let assistantSequence = 0;
          let activeAssistantSequence = 0;
          const agent = new Agent({
            initialState: {
              messages: previousPiContext.messages as AgentMessage[],
              model: piModel,
              systemPrompt: agentSystemPrompt,
              tools: [
                ...createSkillTools(skills),
                ...(execution?.tools ?? []),
                ...(workspaceDir
                  ? [
                      createDeliverFileTool({
                        onDelivered: (file) =>
                          // 非 transient 且无 id：SDK 会将其追加进消息 parts，
                          // 实时渲染的同时随 onEnd 持久化、刷新后可恢复。
                          dataStream.write({
                            data: file,
                            type: "data-delivered-file",
                          }),
                        workspaceDir,
                      }),
                    ]
                  : []),
              ],
            },
            streamFn: streamPiAgent,
            toolExecution: "sequential",
          });

          agent.subscribe((event) => {
            if (
              event.type === "message_start" &&
              event.message.role === "assistant"
            ) {
              assistantSequence += 1;
              activeAssistantSequence = assistantSequence;
            }

            if (
              event.type === "tool_execution_start" ||
              event.type === "tool_execution_end"
            ) {
              const isStart = event.type === "tool_execution_start";
              const isError =
                event.type === "tool_execution_end" && event.isError;
              dataStream.write({
                data: {
                  phase: isStart ? "start" : "end",
                  ...(!isStart && isError ? { isError: true } : {}),
                  message: formatToolStatus(
                    isStart ? "start" : "end",
                    event.toolName,
                    isStart ? event.args : undefined,
                    isError
                  ),
                  toolName: event.toolName,
                },
                transient: true,
                type: "data-tool-status",
              });
              return;
            }

            if (event.type !== "message_update") {
              return;
            }

            const update = event.assistantMessageEvent;
            if (update.type === "start") {
              return;
            }

            markModelActive();
            const contentIndex =
              "contentIndex" in update ? update.contentIndex : 0;
            const textId = `text-${activeAssistantSequence}-${contentIndex}`;
            const reasoningId = `reasoning-${activeAssistantSequence}-${contentIndex}`;

            if (update.type === "text_start") {
              dataStream.write({
                id: textId,
                type: "text-start",
              });
            } else if (update.type === "text_delta") {
              dataStream.write({
                delta: update.delta,
                id: textId,
                type: "text-delta",
              });
            } else if (update.type === "text_end") {
              dataStream.write({
                id: textId,
                type: "text-end",
              });
            } else if (update.type === "thinking_start") {
              dataStream.write({
                id: reasoningId,
                type: "reasoning-start",
              });
            } else if (update.type === "thinking_delta") {
              dataStream.write({
                delta: update.delta,
                id: reasoningId,
                type: "reasoning-delta",
              });
            } else if (update.type === "thinking_end") {
              dataStream.write({
                id: reasoningId,
                type: "reasoning-end",
              });
            }
          });

          const abortAgent = () => agent.abort();
          request.signal.addEventListener("abort", abortAgent, { once: true });
          try {
            await agent.prompt(agentPrompt, preparedAttachments.images);
          } finally {
            request.signal.removeEventListener("abort", abortAgent);
          }

          if (agent.state.errorMessage && !request.signal.aborted) {
            throw new Error(agent.state.errorMessage);
          }
        } finally {
          stopWaitingStatus();
          await execution?.cleanup();
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
      onError: () => "DeepSeek 暂时无法响应，请稍后重试。",
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
