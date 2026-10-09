"use client";

import { useEffect, useRef } from "react";

/** 协作实时事件（与 lib/collab/chat-event-hub.ts 的 ChatCollabEvent 对应的客户端形状）。 */
export type ClientChatCollabEvent =
  | {
      type: "hello";
      connectionId: string;
      onlineUserIds: string[];
      typingUserIds: string[];
    }
  | { type: "presence"; onlineUserIds: string[] }
  | { type: "typing"; userId: string; typing: boolean }
  | { type: "message"; actorId: string | null; role: "assistant" | "user" }
  | { type: "run"; actorId: string | null; phase: "finished" | "started" }
  | { type: "missing" };

export type ChatCollabHandler = (event: ClientChatCollabEvent) => void;

/** typing 上报最小间隔；TTL 为服务端 6s，重报保持指示不灭。 */
const TYPING_REPORT_INTERVAL_MS = 2000;

/**
 * 聊天协作实时订阅（docs/chat-collaboration.md §8.4）：
 * - 成员视图维持一条 EventSource（同源带 cookie，断线自动重连）；
 * - 收到 message/run 通知后由调用方决定重拉 /api/messages 或
 *   resumeStream attach 活跃 run（事件本身不携带消息正文）；
 * - missing（权限复查失败）时由调用方停止订阅并退回非实时。
 *
 * 返回 notifyTyping：输入包装器节流上报（≥2s），false 立即上报。
 */
export function useChatCollab({
  chatId,
  enabled,
  onEvent,
}: {
  chatId: string;
  enabled: boolean;
  onEvent: ChatCollabHandler;
}) {
  // 事件回调保持最新引用，避免 EventSource 因回调重建而反复重连
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const source = new EventSource(
      `${basePath}/api/chat/${encodeURIComponent(chatId)}/events`
    );
    const listener = (event: MessageEvent<string>) => {
      try {
        handlerRef.current(JSON.parse(event.data) as ClientChatCollabEvent);
      } catch {
        // 非法载荷：忽略（服务端契约内事件均为 JSON）
      }
    };
    for (const type of [
      "hello",
      "presence",
      "typing",
      "message",
      "run",
      "missing",
    ] as const) {
      source.addEventListener(type, listener as EventListener);
    }
    return () => {
      source.close();
    };
  }, [chatId, enabled]);

  const lastReportRef = useRef(0);

  const notifyTyping = (typing: boolean) => {
    const now = Date.now();
    if (typing && now - lastReportRef.current < TYPING_REPORT_INTERVAL_MS) {
      return;
    }
    lastReportRef.current = typing ? now : 0;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    fetch(`${basePath}/api/chat/${encodeURIComponent(chatId)}/typing`, {
      body: JSON.stringify({ typing }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
  };

  return { notifyTyping };
}
