import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  attachChatCollabClient,
  CHAT_TYPING_TTL_MS,
  type ChatCollabEvent,
  getChatCollabPresence,
  publishChatMessage,
  publishChatRun,
  resetChatCollabHubForTests,
  setChatTyping,
} from "@/lib/collab/chat-event-hub";

type Received = ChatCollabEvent[];

function makeClient(userId: string): {
  events: Received;
  connectionId: string;
  userId: string;
  send: (event: ChatCollabEvent) => void;
} {
  const events: Received = [];
  return {
    connectionId: crypto.randomUUID(),
    events,
    send: (event) => events.push(event),
    userId,
  };
}

function eventsOf<T extends ChatCollabEvent["type"]>(
  client: ReturnType<typeof makeClient>,
  type: T
): Extract<ChatCollabEvent, { type: T }>[] {
  return client.events.filter(
    (event): event is Extract<ChatCollabEvent, { type: T }> =>
      event.type === type
  );
}

test.beforeEach(() => {
  resetChatCollabHubForTests();
});

test("attach sends hello to self and presence to others", () => {
  const chatId = crypto.randomUUID();
  const alice = makeClient("alice");
  const bob = makeClient("bob");

  const a = attachChatCollabClient({
    chatId,
    connectionId: alice.connectionId,
    send: alice.send,
    userId: alice.userId,
  });

  const hellos = eventsOf(alice, "hello");
  assert.equal(hellos.length, 1);
  assert.deepEqual(hellos[0]?.onlineUserIds, ["alice"]);
  assert.deepEqual(hellos[0]?.typingUserIds, []);

  attachChatCollabClient({
    chatId,
    connectionId: bob.connectionId,
    send: bob.send,
    userId: bob.userId,
  });

  // alice 收到 bob 加入后的 presence（含两人）
  const presences = eventsOf(alice, "presence");
  assert.equal(presences.length, 2);
  assert.deepEqual(presences[1]?.onlineUserIds.sort(), ["alice", "bob"]);

  a.detach();
  const bobPresences = eventsOf(bob, "presence");
  // bob 自己加入时 1 次 + alice 离开时 1 次；离开后的名单只剩 bob
  assert.equal(bobPresences.length, 2);
  assert.deepEqual(bobPresences[1]?.onlineUserIds, ["bob"]);
});

test("detach of last client clears the room", () => {
  const chatId = crypto.randomUUID();
  const alice = makeClient("alice");
  const a = attachChatCollabClient({
    chatId,
    connectionId: alice.connectionId,
    send: alice.send,
    userId: alice.userId,
  });
  assert.deepEqual(getChatCollabPresence(chatId).onlineUserIds, ["alice"]);

  a.detach();
  assert.deepEqual(getChatCollabPresence(chatId), {
    onlineUserIds: [],
    typingUserIds: [],
  });
  // 房间已删：后续发布为 no-op，不抛错、不产生新事件
  const before = alice.events.length;
  publishChatMessage({ actorId: "alice", chatId, role: "user" });
  publishChatRun({ actorId: "alice", chatId, phase: "started" });
  assert.equal(alice.events.length, before);
});

test("typing broadcasts and expires after TTL", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const chatId = crypto.randomUUID();
    const alice = makeClient("alice");
    const bob = makeClient("bob");
    attachChatCollabClient({
      chatId,
      connectionId: alice.connectionId,
      send: alice.send,
      userId: alice.userId,
    });
    attachChatCollabClient({
      chatId,
      connectionId: bob.connectionId,
      send: bob.send,
      userId: bob.userId,
    });
    alice.events.length = 0;
    bob.events.length = 0;

    setChatTyping({ chatId, typing: true, userId: "alice" });
    assert.deepEqual(getChatCollabPresence(chatId).typingUserIds, ["alice"]);
    const typingEvents = eventsOf(bob, "typing");
    assert.equal(typingEvents.length, 1);
    assert.equal(typingEvents[0]?.typing, true);

    mock.timers.tick(CHAT_TYPING_TTL_MS + 1);
    assert.deepEqual(getChatCollabPresence(chatId).typingUserIds, []);
    const expired = eventsOf(bob, "typing");
    assert.equal(expired.length, 2);
    assert.equal(expired[1]?.typing, false);

    // 手动停止：立即清除并广播
    setChatTyping({ chatId, typing: true, userId: "bob" });
    setChatTyping({ chatId, typing: false, userId: "bob" });
    assert.deepEqual(getChatCollabPresence(chatId).typingUserIds, []);
  } finally {
    mock.timers.reset();
  }
});

test("message and run events broadcast to room with actor attribution", () => {
  const chatId = crypto.randomUUID();
  const alice = makeClient("alice");
  const bob = makeClient("bob");
  attachChatCollabClient({
    chatId,
    connectionId: alice.connectionId,
    send: alice.send,
    userId: alice.userId,
  });
  attachChatCollabClient({
    chatId,
    connectionId: bob.connectionId,
    send: bob.send,
    userId: bob.userId,
  });
  alice.events.length = 0;
  bob.events.length = 0;

  publishChatMessage({ actorId: "alice", chatId, role: "user" });
  publishChatRun({ actorId: null, chatId, phase: "finished" });

  const messages = eventsOf(bob, "message");
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.actorId, "alice");
  const runs = eventsOf(alice, "run");
  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.actorId, null);
  // 事件不携带消息正文
  assert.ok(!JSON.stringify(messages[0]).includes("parts"));
});

test("typing cleared when the user's last connection detaches", () => {
  const chatId = crypto.randomUUID();
  const tab1 = makeClient("alice");
  const tab2 = makeClient("alice");
  const bob = makeClient("bob");
  const a1 = attachChatCollabClient({
    chatId,
    connectionId: tab1.connectionId,
    send: tab1.send,
    userId: "alice",
  });
  const a2 = attachChatCollabClient({
    chatId,
    connectionId: tab2.connectionId,
    send: tab2.send,
    userId: "alice",
  });
  attachChatCollabClient({
    chatId,
    connectionId: bob.connectionId,
    send: bob.send,
    userId: "bob",
  });

  setChatTyping({ chatId, typing: true, userId: "alice" });
  assert.deepEqual(getChatCollabPresence(chatId).typingUserIds, ["alice"]);

  // 第一个 tab 断开：仍有同用户连接，typing 保留
  a1.detach();
  assert.deepEqual(getChatCollabPresence(chatId).typingUserIds, ["alice"]);

  // 同用户最后一个 tab 断开：typing 清除并向剩余成员广播停止
  bob.events.length = 0;
  a2.detach();
  assert.deepEqual(getChatCollabPresence(chatId).typingUserIds, []);
  const stopped = eventsOf(bob, "typing").at(-1);
  assert.equal(stopped?.type, "typing");
  assert.equal(stopped?.typing, false);
});
