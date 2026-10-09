/**
 * 聊天协作实时事件 hub（进程内 pub/sub）。
 *
 * 参考 pi-pocket 的 Room/presence/typing 机制（src/server/room.ts），按
 * piwork 架构适配为「通知与内容分离」：SSE 只承载小事件，消息真相始终
 * 在 PostgreSQL（Message_v2），客户端收到事件后重拉 /api/messages 或
 * resumeStream attach 活跃 run。
 *
 * 边界（与 docs/chat-collaboration.md §8 一致）：
 * - 单常驻 Node 实例前提；无跨进程/多副本广播，不提供容量保证；
 * - 状态纯内存：presence/typing 重启即失，SSE 客户端自动重连重建；
 * - typing 6s TTL 自动清除（与 pi-pocket TYPING_MS 一致）；
 * - 房间无连接即删除，无 pi-pocket 的 30s 宽限（SSE 连接即状态本体，
 *   刷新重连代价由客户端 retry 承担）。
 */

/** typing 指示的存活时长；客户端应在到期前重报（节流 ≥2s）。 */
export const CHAT_TYPING_TTL_MS = 6000;

export type ChatCollabEvent =
  | {
      type: "hello";
      connectionId: string;
      onlineUserIds: string[];
      typingUserIds: string[];
    }
  | { type: "presence"; onlineUserIds: string[] }
  | { type: "typing"; userId: string; typing: boolean }
  /**
   * 新消息已持久化（仅通知，不携带正文）。actorId 为 null 表示发布点
   * 无法确定运行归属（assistant 终态 upsert），客户端不 做 self-skip。
   */
  | { type: "message"; actorId: string | null; role: "assistant" | "user" }
  | { type: "run"; actorId: string | null; phase: "finished" | "started" }
  /** 权限复查失败：客户端应停止订阅（界面退回非实时）。 */
  | { type: "missing" };

interface CollabClient {
  readonly connectionId: string;
  send: (event: ChatCollabEvent) => void;
  readonly userId: string;
}

interface RoomState {
  readonly clients: Map<string, CollabClient>;
  /** userId → 到期清除定时器；仅记录「正在输入」的用户。 */
  readonly typing: Map<string, NodeJS.Timeout>;
}

const globalForCollab = globalThis as unknown as {
  __piworkChatCollabHub?: Map<string, RoomState>;
};

/** HMR 安全：模块热替换间复用同一 hub 实例，避免孤儿订阅丢失。 */
const rooms: Map<string, RoomState> =
  globalForCollab.__piworkChatCollabHub ?? new Map<string, RoomState>();
globalForCollab.__piworkChatCollabHub = rooms;

function roomOf(chatId: string): RoomState {
  let room = rooms.get(chatId);
  if (!room) {
    room = { clients: new Map(), typing: new Map() };
    rooms.set(chatId, room);
  }
  return room;
}

function broadcast(room: RoomState, event: ChatCollabEvent): void {
  for (const client of room.clients.values()) {
    client.send(event);
  }
}

function onlineUserIds(room: RoomState): string[] {
  return [...new Set([...room.clients.values()].map((c) => c.userId))];
}

export interface ChatCollabAttachment {
  /** 从房间移除本连接（幂等）。 */
  detach: () => void;
}

/**
 * SSE 连接加入房间：向自己发 hello（含在线/typing 快照与 connectionId），
 * 向他者广播 presence。连接断开由调用方（SSE route）触发 detach。
 */
export function attachChatCollabClient({
  chatId,
  connectionId,
  send,
  userId,
}: {
  chatId: string;
  connectionId: string;
  send: (event: ChatCollabEvent) => void;
  userId: string;
}): ChatCollabAttachment {
  const room = roomOf(chatId);
  const client: CollabClient = { connectionId, send, userId };
  room.clients.set(connectionId, client);

  send({
    connectionId,
    onlineUserIds: onlineUserIds(room),
    type: "hello",
    typingUserIds: [...room.typing.keys()],
  });
  broadcast(room, { onlineUserIds: onlineUserIds(room), type: "presence" });

  return {
    detach: () => {
      const current = rooms.get(chatId);
      if (!current?.clients.delete(connectionId)) {
        return;
      }
      // 本用户已无任何连接时清除其 typing 态，避免残留指示
      if (![...current.clients.values()].some((c) => c.userId === userId)) {
        const timer = current.typing.get(userId);
        if (timer) {
          clearTimeout(timer);
          current.typing.delete(userId);
          broadcast(current, { type: "typing", typing: false, userId });
        }
      }
      if (current.clients.size === 0) {
        for (const timer of current.typing.values()) {
          clearTimeout(timer);
        }
        current.typing.clear();
        rooms.delete(chatId);
      } else {
        broadcast(current, {
          onlineUserIds: onlineUserIds(current),
          type: "presence",
        });
      }
    },
  };
}

/** 新消息已落库后的通知（正文不随事件下发）。 */
export function publishChatMessage({
  actorId,
  chatId,
  role,
}: {
  actorId: string | null;
  chatId: string;
  role: "assistant" | "user";
}): void {
  const room = rooms.get(chatId);
  if (!room) {
    return;
  }
  broadcast(room, { actorId, role, type: "message" });
}

/** run 生命周期通知：started 供 watcher resumeStream attach 活跃 run。 */
export function publishChatRun({
  actorId,
  chatId,
  phase,
}: {
  actorId: string | null;
  chatId: string;
  phase: "finished" | "started";
}): void {
  const room = rooms.get(chatId);
  if (!room) {
    return;
  }
  broadcast(room, { actorId, phase, type: "run" });
}

/** 用户开始/停止输入；true 时起 6s TTL，到期自动向房间广播停止。 */
export function setChatTyping({
  chatId,
  typing,
  userId,
}: {
  chatId: string;
  typing: boolean;
  userId: string;
}): void {
  const room = rooms.get(chatId);
  if (!room) {
    return;
  }

  const existing = room.typing.get(userId);
  if (existing) {
    clearTimeout(existing);
    room.typing.delete(userId);
  }

  if (typing) {
    const timer = setTimeout(() => {
      const current = rooms.get(chatId);
      if (!current) {
        return;
      }
      current.typing.delete(userId);
      broadcast(current, { type: "typing", typing: false, userId });
    }, CHAT_TYPING_TTL_MS);
    timer.unref();
    room.typing.set(userId, timer);
  }

  broadcast(room, { type: "typing", typing, userId });
}

/** 测试/诊断辅助：当前房间在线/输入中的用户快照。 */
export function getChatCollabPresence(chatId: string): {
  onlineUserIds: string[];
  typingUserIds: string[];
} {
  const room = rooms.get(chatId);
  if (!room) {
    return { onlineUserIds: [], typingUserIds: [] };
  }
  return {
    onlineUserIds: onlineUserIds(room),
    typingUserIds: [...room.typing.keys()],
  };
}

/** 测试/诊断辅助：清空全部房间（仅测试使用）。 */
export function resetChatCollabHubForTests(): void {
  for (const room of rooms.values()) {
    for (const timer of room.typing.values()) {
      clearTimeout(timer);
    }
    room.typing.clear();
    room.clients.clear();
  }
  rooms.clear();
}
