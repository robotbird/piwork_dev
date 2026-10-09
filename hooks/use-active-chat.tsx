"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import { toast } from "@/components/chat/toast";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { type ChatModelCatalog, resolveChatModelId } from "@/hooks/chat-model";
import { isChatApprovalContinuation } from "@/hooks/chat-request";
import { useAutoResume } from "@/hooks/use-auto-resume";
import {
  type ClientChatCollabEvent,
  useChatCollab,
} from "@/hooks/use-chat-collab";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage, ChatMyRole, ChatParticipantInfo } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";

type ActiveChatContextValue = {
  chatId: string;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  visibilityType: VisibilityType;
  isReadonly: boolean;
  isLoading: boolean;
  votes: Vote[] | undefined;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
  showCreditCardAlert: boolean;
  setShowCreditCardAlert: Dispatch<SetStateAction<boolean>>;
  /** 分享协作：本人在对话中的角色；新对话视为 owner */
  myRole: ChatMyRole;
  /** 参与者名单（所有者 + 协作成员），仅对话成员可见 */
  participants: ChatParticipantInfo[];
  /** 协作实时：当前在线的用户 id（含本人）；非成员/新对话为空 */
  onlineUserIds: string[];
  /** 协作实时：正在输入的用户 id（已排除本人）；仅展示用途 */
  typingUserIds: string[];
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const sandboxView = useSearchParams().get("sandbox");
  const { setDataStream, setToolStatus, setWaitingStatus } = useDataStream();
  const { mutate } = useSWRConfig();

  const chatIdFromUrl = extractChatId(pathname);
  const isNewChat = !chatIdFromUrl;
  const newChatIdRef = useRef(generateUUID());
  const prevPathnameRef = useRef(pathname);

  if (isNewChat && prevPathnameRef.current !== pathname) {
    newChatIdRef.current = generateUUID();
  }
  prevPathnameRef.current = pathname;

  const chatId = chatIdFromUrl ?? newChatIdRef.current;

  // (runId, seq) 游标（§2.5）：wire transient part 写入、断线重连经 query
  // 回传。只存内存——刷新后为空即全量重放，本就正确。
  const runtimeCursorRef = useRef<{
    chatId: string;
    runId: string;
    seq: number;
  } | null>(null);

  const [preferredModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const [modelPreferenceLoaded, setModelPreferenceLoaded] = useState(false);
  const { data: modelCatalog } = useSWR<ChatModelCatalog>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const resolvedModelId = modelPreferenceLoaded
    ? resolveChatModelId(modelCatalog, preferredModelId)
    : null;
  const currentModelId = resolvedModelId ?? "";
  const currentModelIdRef = useRef<string | null>(resolvedModelId);
  currentModelIdRef.current = resolvedModelId;

  const [input, setInput] = useState("");
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);

  const { data: chatData, isLoading } = useSWR(
    isNewChat
      ? null
      : sandboxView
        ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/admin/sandboxes/${encodeURIComponent(sandboxView)}/task?chatId=${chatId}`
        : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const initialMessages: ChatMessage[] = isNewChat
    ? []
    : (chatData?.messages ?? []);
  const visibility: VisibilityType = isNewChat
    ? "private"
    : (chatData?.visibility ?? "private");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    generateId: generateUUID,
    id: chatId,
    messages: initialMessages,
    onData: (dataPart) => {
      if (dataPart.type === "data-waiting-status") {
        setWaitingStatus(dataPart.data);
        return;
      }
      if (dataPart.type === "data-tool-status") {
        setToolStatus(
          dataPart.data.phase === "start" ? dataPart.data : undefined
        );
        return;
      }
      if (dataPart.type === "data-delivered-file") {
        // 由消息 parts 渲染（dataStream.write 无 id 时 SDK 会追加进 parts），
        // 不进入全局 dataStream 数组。
        return;
      }
      if (dataPart.type === "data-runtime-cursor") {
        runtimeCursorRef.current = {
          chatId,
          runId: dataPart.data.runId,
          seq: dataPart.data.seq,
        };
        return;
      }
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onError: (error) => {
      if (error.message?.includes("AI Gateway requires a valid credit card")) {
        setShowCreditCardAlert(true);
      } else if (error instanceof ChatbotError) {
        toast({ description: error.message, type: "error" });
      } else {
        toast({
          description: error.message || "Oops, an error occurred!",
          type: "error",
        });
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      mutate(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`
      );
    },
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      return (
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
      fetch: async (requestInput, init) => {
        const response = await fetchWithErrorHandlers(requestInput, init);
        if (init?.method === "POST") {
          // POST 成功时 Chat/用户消息已落库；不要等模型完成才刷新成员信息和侧栏。
          // 闭包保留发送时的 chatId，等待响应期间切换对话也不会刷新错会话。
          mutate(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`
          );
          mutate(unstable_serialize(getChatHistoryPaginationKey));
        }
        return response;
      },
      // 断线重连（未刷新）：带上最近游标，服务端按 seq > cursor 续传；
      // 无游标或 chatId 不符则走默认 URL（全量重放）
      prepareReconnectToStreamRequest(request) {
        const cursor = runtimeCursorRef.current;
        if (!cursor || cursor.chatId !== request.id) {
          return {};
        }
        const params = new URLSearchParams({
          cursor: String(cursor.seq),
          runId: cursor.runId,
        });
        return {
          api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat/${request.id}/stream?${params.toString()}`,
        };
      },
      prepareSendMessagesRequest(request) {
        if (!currentModelIdRef.current) {
          throw new ChatbotError("forbidden:model");
        }
        const lastMessage = request.messages.at(-1);
        const isToolApprovalContinuation = isChatApprovalContinuation(
          request.messages
        );

        return {
          body: {
            id: request.id,
            ...(isToolApprovalContinuation
              ? { messages: request.messages }
              : { message: lastMessage }),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibility,
            ...request.body,
          },
        };
      },
    }),
  });

  useEffect(() => {
    if (status === "submitted" || status === "ready" || status === "error") {
      setWaitingStatus(undefined);
      setToolStatus(undefined);
    }
  }, [status, setToolStatus, setWaitingStatus]);

  // useChat 在 id 切换时创建新实例，每次进入历史对话都需要水合。
  // 新对话只更新 URL（id 不变）时保留本地流，不用 DB 快照覆盖正在生成的消息。
  const hydratedChatRef = useRef({ chatId, hydrated: isNewChat });
  if (hydratedChatRef.current.chatId !== chatId) {
    hydratedChatRef.current = { chatId, hydrated: isNewChat };
  }

  useEffect(() => {
    if (
      hydratedChatRef.current.chatId !== chatId ||
      hydratedChatRef.current.hydrated
    ) {
      return;
    }
    if (chatData?.messages) {
      hydratedChatRef.current.hydrated = true;
      setMessages(chatData.messages);
    }
  }, [chatId, chatData?.messages, setMessages]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      runtimeCursorRef.current = null;
      if (isNewChat) {
        setMessages([]);
      }
    }
  }, [chatId, isNewChat, setMessages]);

  useEffect(() => {
    const cookieModel = document.cookie
      .split("; ")
      .find((row) => row.startsWith("chat-model="))
      ?.split("=")[1];
    if (cookieModel) {
      try {
        setCurrentModelId(decodeURIComponent(cookieModel));
      } catch {
        // Malformed or stale preferences never grant model access.
      }
    }
    setModelPreferenceLoaded(true);
  }, []);

  const hasAppendedQueryRef = useRef(false);
  useEffect(() => {
    if (
      sandboxView ||
      !resolvedModelId ||
      (!isNewChat && (!chatData || chatData.isReadonly))
    ) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (!query) {
      hasAppendedQueryRef.current = false;
      return;
    }
    if (hasAppendedQueryRef.current) {
      return;
    }
    hasAppendedQueryRef.current = true;
    // 项目聊天页 (/projects/:id/chat/:cid?query=) 就地消费 query；
    // 其他入口（如 /?query=）进入后需要把客户端生成的 chatId 写进 URL
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const currentPath = window.location.pathname;
    const target = /\/chat\/[^/]+/.test(currentPath)
      ? currentPath
      : `${basePath}/chat/${chatId}`;
    window.history.replaceState({}, "", target);
    sendMessage({
      parts: [{ text: query, type: "text" }],
      role: "user" as const,
    });
  }, [sendMessage, chatId, sandboxView, resolvedModelId, isNewChat, chatData]);

  useAutoResume({
    autoResume:
      !sandboxView &&
      !isNewChat &&
      !!chatData &&
      !chatData.isReadonly &&
      status === "ready",
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isReadonly =
    Boolean(sandboxView) ||
    (isNewChat ? false : (chatData?.isReadonly ?? false));

  // 分享协作：/api/messages 对成员下发 myRole/participants；非成员/新对话为空。
  const myRole: ChatMyRole = isNewChat ? "owner" : (chatData?.myRole ?? null);
  const participants: ChatParticipantInfo[] = isNewChat
    ? []
    : (chatData?.participants ?? []);

  const { data: votes } = useSWR<Vote[]>(
    !isReadonly && messages.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // ── 协作实时（docs/chat-collaboration.md §8.4）──
  const { data: sessionData } = useSession();
  const selfUserId = sessionData?.user?.id ?? null;

  // 事件处理里读最新 status：自己流进行中不重拉/不 attach
  const statusRef = useRef(status);
  statusRef.current = status;

  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  // typing 客户端兑底清除（服务端 6s TTL 丢失时防止残留指示）
  const typingFallbackTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  const collabEnabled =
    !isNewChat && !sandboxView && myRole !== null && !isReadonly;

  const handleCollabEvent = useCallback(
    (event: ClientChatCollabEvent) => {
      switch (event.type) {
        case "hello":
        case "presence":
          setOnlineUserIds(event.onlineUserIds);
          break;
        case "typing": {
          setTypingUserIds((prev) => {
            const next = event.typing
              ? [...new Set([...prev, event.userId])]
              : prev.filter((id) => id !== event.userId);
            return next;
          });
          const timers = typingFallbackTimersRef.current;
          const existing = timers.get(event.userId);
          if (existing) {
            clearTimeout(existing);
            timers.delete(event.userId);
          }
          if (event.typing) {
            const timer = setTimeout(() => {
              timers.delete(event.userId);
              setTypingUserIds((prev) =>
                prev.filter((id) => id !== event.userId)
              );
            }, 8000);
            timers.set(event.userId, timer);
          }
          break;
        }
        case "message": {
          if (event.actorId && event.actorId === selfUserId) {
            return; // 自己的用户消息已在本地流内
          }
          if (statusRef.current !== "ready") {
            return; // 本地流进行中：终态后消息以 DB 为准重拉兑底
          }
          const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
          (async () => {
            try {
              const response = await fetch(
                `${basePath}/api/messages?chatId=${chatId}`
              );
              if (!response.ok) {
                return;
              }
              const data = (await response.json()) as {
                messages: ChatMessage[];
              };
              setMessages(data.messages);
              mutate(`${basePath}/api/messages?chatId=${chatId}`);
            } catch {
              // 拉取失败：下次事件/刷新再同步，不打断当前视图
            }
          })().catch(() => undefined);
          break;
        }
        case "run": {
          if (event.actorId && event.actorId === selfUserId) {
            return; // 自己发起的 run 已在本地流内
          }
          if (event.phase !== "started" || statusRef.current !== "ready") {
            return;
          }
          // 他人发起 run：复用断线重连机制 attach 活跃 run
          resumeStream();
          break;
        }
        case "missing":
          setOnlineUserIds([]);
          setTypingUserIds([]);
          break;
        default:
          break;
      }
    },
    [chatId, mutate, resumeStream, selfUserId, setMessages]
  );

  const { notifyTyping } = useChatCollab({
    chatId,
    enabled: collabEnabled,
    onEvent: handleCollabEvent,
  });

  // typing 上报卸载时清兑底定时器
  useEffect(
    () => () => {
      for (const timer of typingFallbackTimersRef.current.values()) {
        clearTimeout(timer);
      }
      typingFallbackTimersRef.current.clear();
    },
    []
  );

  // 输入包装：输入时节流上报 typing；清空（发送后）上报停止
  const handleSetInput: Dispatch<SetStateAction<string>> = useCallback(
    (action) => {
      setInput((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        if (next.trim() && next !== prev) {
          notifyTyping(true);
        } else if (!next.trim()) {
          notifyTyping(false);
        }
        return next;
      });
    },
    [notifyTyping]
  );

  const visibleTypingUserIds = typingUserIds.filter((id) => id !== selfUserId);

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      addToolApprovalResponse,
      chatId,
      currentModelId,
      input,
      isLoading: !resolvedModelId || (!isNewChat && isLoading),
      isReadonly,
      messages,
      myRole,
      onlineUserIds,
      participants,
      regenerate,
      sendMessage,
      setCurrentModelId,
      setInput: handleSetInput,
      setMessages,
      setShowCreditCardAlert,
      showCreditCardAlert,
      status,
      stop,
      typingUserIds: visibleTypingUserIds,
      visibilityType: visibility,
      votes,
    }),
    [
      chatId,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      addToolApprovalResponse,
      input,
      visibility,
      isReadonly,
      isNewChat,
      isLoading,
      resolvedModelId,
      votes,
      currentModelId,
      showCreditCardAlert,
      myRole,
      participants,
      onlineUserIds,
      visibleTypingUserIds,
      handleSetInput,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
