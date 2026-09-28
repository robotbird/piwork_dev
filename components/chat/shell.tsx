"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  initialArtifactData,
  useArtifact,
  useArtifactSelector,
} from "@/hooks/use-artifact";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Artifact } from "./artifact";
import { ChatHeader } from "./chat-header";
import { DataStreamHandler } from "./data-stream-handler";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

export function ChatShell() {
  const { t } = usePreferences();
  const pathname = usePathname();
  const {
    chatId,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    input,
    setInput,
    visibilityType,
    isReadonly,
    isLoading,
    votes,
    currentModelId,
    setCurrentModelId,
  } = useActiveChat();

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact } = useArtifact();
  const conversationTitle = useMemo(() => {
    const firstUserMessage = messages.find(
      (message) => message.role === "user"
    );
    const text = firstUserMessage?.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();

    if (!text) {
      return t("chat.newChat");
    }

    return text.length > 28 ? `${text.slice(0, 28)}…` : text;
  }, [messages, t]);

  // stopRef（v2.0 Step 2 语义）：切走 chat 只断本地订阅（原 stop），run 在
  // 服务端继续；切回时 useAutoResume → resumeStream 从游标接上活流。
  const stopRef = useRef(stop);
  stopRef.current = stop;

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setArtifact(initialArtifactData);
      setEditingMessage(null);
      setAttachments([]);
    }
  }, [chatId, setArtifact]);

  const handleEditMessage = useCallback(
    (msg: ChatMessage) => {
      const text = msg.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      setInput(text ?? "");
      setEditingMessage(msg);
    },
    [setInput]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInput("");
  }, [setInput]);

  const handleSendEditedMessage = useCallback(async () => {
    if (!editingMessage) {
      return;
    }

    const msg = editingMessage;
    setEditingMessage(null);
    await submitEditedMessage({
      message: msg,
      regenerate,
      setMessages,
      text: input,
    });
    setInput("");
  }, [editingMessage, input, regenerate, setInput, setMessages]);

  if (
    pathname === "/skills" ||
    pathname.startsWith("/documents") ||
    pathname === "/scheduled-tasks"
  ) {
    return null;
  }

  return (
    <>
      <div className="openai-chat flex h-dvh w-full flex-row overflow-hidden">
        <div
          className={cn(
            "flex min-w-0 flex-col bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isArtifactVisible ? "w-[40%]" : "w-full"
          )}
        >
          <ChatHeader
            chatId={chatId}
            hasMessages={messages.length > 0}
            isReadonly={isReadonly}
            selectedVisibilityType={visibilityType}
            title={conversationTitle}
          />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <Messages
              addToolApprovalResponse={addToolApprovalResponse}
              chatId={chatId}
              isArtifactVisible={isArtifactVisible}
              isLoading={isLoading}
              isReadonly={isReadonly}
              messages={messages}
              onEditMessage={handleEditMessage}
              regenerate={regenerate}
              selectedModelId={currentModelId}
              setMessages={setMessages}
              status={status}
              votes={votes}
            />

            <div
              className={cn(
                // z-20：必须高于 Messages 中 Greeting 的 z-10 遮罩层，
                // 否则空会话时问候文字会盖住 slash 命令浮层
                "z-20 mx-auto flex w-full flex-col items-center gap-2 bg-transparent px-4 md:px-8",
                messages.length === 0
                  ? "absolute max-w-[var(--chat-composer-max)]"
                  : "sticky bottom-0 max-w-[var(--chat-content-max)] pb-[max(16px,env(safe-area-inset-bottom))] md:pb-6"
              )}
              style={
                messages.length === 0
                  ? {
                      left: "50%",
                      top: "37.5%",
                      transform: "translateX(-50%)",
                    }
                  : undefined
              }
            >
              {messages.length > 0 ? (
                <p className="text-center text-[12px] leading-5 text-muted-foreground/70">
                  {t("chat.piworkCanMakeMistakesCheckImportantInformation")}
                </p>
              ) : null}
              {!isReadonly && (
                <MultimodalInput
                  attachments={attachments}
                  chatId={chatId}
                  editingMessage={editingMessage}
                  input={input}
                  isLoading={isLoading}
                  messages={messages}
                  onCancelEdit={handleCancelEdit}
                  onModelChange={setCurrentModelId}
                  selectedModelId={currentModelId}
                  selectedVisibilityType={visibilityType}
                  sendMessage={
                    editingMessage ? handleSendEditedMessage : sendMessage
                  }
                  setAttachments={setAttachments}
                  setInput={setInput}
                  setMessages={setMessages}
                  status={status}
                  stop={stop}
                />
              )}
            </div>
          </div>
        </div>

        <Artifact
          addToolApprovalResponse={addToolApprovalResponse}
          attachments={attachments}
          chatId={chatId}
          input={input}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          selectedVisibilityType={visibilityType}
          sendMessage={sendMessage}
          setAttachments={setAttachments}
          setInput={setInput}
          setMessages={setMessages}
          status={status}
          stop={stop}
          votes={votes}
        />
      </div>

      <DataStreamHandler />
    </>
  );
}
