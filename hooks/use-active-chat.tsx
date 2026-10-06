"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
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
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
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
      fetch: fetchWithErrorHandlers,
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

  const loadedChatIds = useRef(new Set<string>());

  if (isNewChat && !loadedChatIds.current.has(newChatIdRef.current)) {
    loadedChatIds.current.add(newChatIdRef.current);
  }

  useEffect(() => {
    if (loadedChatIds.current.has(chatId)) {
      return;
    }
    if (chatData?.messages) {
      loadedChatIds.current.add(chatId);
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
      !sandboxView && !isNewChat && !!chatData && !chatData.isReadonly,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isReadonly =
    Boolean(sandboxView) ||
    (isNewChat ? false : (chatData?.isReadonly ?? false));

  const { data: votes } = useSWR<Vote[]>(
    !isReadonly && messages.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      addToolApprovalResponse,
      chatId,
      currentModelId,
      input,
      isLoading: !resolvedModelId || (!isNewChat && isLoading),
      isReadonly,
      messages,
      regenerate,
      sendMessage,
      setCurrentModelId,
      setInput,
      setMessages,
      setShowCreditCardAlert,
      showCreditCardAlert,
      status,
      stop,
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
