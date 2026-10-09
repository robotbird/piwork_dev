"use client";

import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";

const MAX_STACK = 4;

/**
 * 对话参与者头像堆叠：最多 4 个，超出显示 +N。分享协作的成员在对话头部的
 * 常驻展示；单人对话不渲染（由调用方判断）。
 *
 * 实时态（docs/chat-collaboration.md §8）：在线参与者头像右下角显示小绿点；
 * 正在输入的参与者显示蓝色脉冲点（蓝色仅表达「进行中」的设计语义）。
 */
export function ParticipantAvatars({
  onlineUserIds = [],
  participants,
  size = 24,
  typingUserIds = [],
}: {
  onlineUserIds?: string[];
  participants: { image: string | null; name: string | null; userId: string }[];
  size?: number;
  typingUserIds?: string[];
}) {
  if (participants.length === 0) {
    return null;
  }

  const visible = participants.slice(0, MAX_STACK);
  const overflow = participants.length - visible.length;
  const online = new Set(onlineUserIds);
  const typing = new Set(typingUserIds);
  const dot = Math.max(7, Math.round(size * 0.33));

  return (
    <div className="flex items-center pr-1">
      <div className="flex items-center">
        {visible.map((participant, index) => {
          const isTyping = typing.has(participant.userId);
          return (
            <span
              className={cn(
                "relative rounded-full ring-2 ring-background",
                index > 0 && "-ml-1.5"
              )}
              key={participant.userId}
              style={{ zIndex: MAX_STACK - index }}
            >
              <UserAvatar
                image={participant.image}
                name={participant.name}
                size={size}
              />
              {online.has(participant.userId) ? (
                <span
                  className={cn(
                    "absolute right-0 bottom-0 rounded-full ring-2 ring-background",
                    isTyping
                      ? "animate-pulse bg-[var(--primary)]"
                      : "bg-emerald-500"
                  )}
                  style={{ height: dot, width: dot }}
                />
              ) : null}
            </span>
          );
        })}
      </div>
      {overflow > 0 ? (
        <span
          className="-ml-1.5 flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background"
          style={{
            fontSize: Math.max(10, size * 0.38),
            height: size,
            minWidth: size,
            paddingInline: size * 0.15,
            zIndex: 0,
          }}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
