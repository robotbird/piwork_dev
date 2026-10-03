import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import type { JsonAgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { StoredFile } from "@/lib/ai/file-store";
import { AsyncEventQueue } from "@/lib/runtime/backends/event-queue";
import { createArtifactGateway } from "@/lib/runtime/backends/sandbox-rpc/artifact-gateway";
import type { RuntimeEvent } from "@/lib/runtime/protocol";

/**
 * Artifact Gateway 宿主侧单测（spec §6 Phase 2 出站基线）：manifest 收割、
 * 幂等、坏输入容忍（交付 best-effort 不击穿 run）。全链路（沙箱内 extension
 * → outbox → 收割）见 sandbox-rpc.test.ts 的 deliver_file 集成用例。
 */

type Harness = {
  archived: Array<{ chatId: string; file: StoredFile; size: number }>;
  files: Map<string, Uint8Array>;
  queue: AsyncEventQueue<RuntimeEvent>;
  stored: Array<{ buffer: Uint8Array; contentType: string; filename: string }>;
};

function makeGateway(
  files: Record<string, string | Uint8Array>,
  options: { failRead?: (file: string) => boolean } = {}
) {
  const harness: Harness = {
    archived: [],
    files: new Map(
      Object.entries(files).map(([key, value]) => [
        key,
        typeof value === "string" ? new TextEncoder().encode(value) : value,
      ])
    ),
    queue: new AsyncEventQueue<RuntimeEvent>(),
    stored: [],
  };
  const gateway = createArtifactGateway({
    archiveFile: (chatId, file, size) => {
      harness.archived.push({ chatId, file, size });
      return Promise.resolve();
    },
    chatId: "00000000-0000-0000-0000-0000000000c1",
    queue: harness.queue,
    readFile: (file) => {
      const bytes = harness.files.get(file);
      if (options.failRead?.(file) || !bytes) {
        return Promise.reject(new Error(`read failed: ${file}`));
      }
      return Promise.resolve(bytes);
    },
    store: (input) => {
      harness.stored.push(input);
      const stored: StoredFile = {
        contentType: input.contentType,
        name: input.filename,
        pathname: `blob/${input.filename}`,
        url: `https://blob.test/${input.filename}`,
      };
      return Promise.resolve(stored);
    },
  });
  return { gateway, harness };
}

function deliverFileEnd(manifest: string): JsonAgentSessionEvent {
  return {
    isError: false,
    result: { content: [], details: { id: manifest, manifest } },
    toolCallId: "call-1",
    toolName: "deliver_file",
    type: "tool_execution_end",
  } as unknown as JsonAgentSessionEvent;
}

/** 全量排空队列（调用方负责 queue.end()） */
function drain(harness: Harness): Promise<RuntimeEvent[]> {
  const events: RuntimeEvent[] = [];
  const done = (async () => {
    for await (const event of harness.queue.iterate()) {
      events.push(event);
    }
  })();
  return done.then(() => events);
}

test("manifest 收割：store + archive + artifact.created", async () => {
  const manifestId = "11111111-1111-4111-8111-111111111111";
  const { gateway, harness } = makeGateway({
    [`piwork/outbox/${manifestId}.json`]: JSON.stringify({
      filename: "report.pdf",
      id: manifestId,
      path: "out/report.pdf",
      size: 9,
    }),
    "out/report.pdf": new TextEncoder().encode("PDF-bytes"),
  });
  const collected = drain(harness);
  gateway.handleEvent(deliverFileEnd(`piwork/outbox/${manifestId}.json`));
  await gateway.flush();
  harness.queue.end();
  const events = await collected;

  assert.deepEqual(
    harness.stored.map((stored) => stored.filename),
    ["report.pdf"]
  );
  assert.deepEqual(
    harness.stored[0]?.buffer,
    new TextEncoder().encode("PDF-bytes")
  );
  assert.equal(harness.stored[0]?.contentType, "application/pdf");
  assert.deepEqual(
    harness.archived.map((entry) => entry.chatId),
    ["00000000-0000-0000-0000-0000000000c1"]
  );
  assert.equal(harness.archived[0]?.size, 9);
  const artifact = events.find(
    (event): event is Extract<RuntimeEvent, { type: "artifact.created" }> =>
      event.type === "artifact.created"
  );
  assert.ok(artifact, "应发出 artifact.created");
  assert.equal(artifact.file.filename, "report.pdf");
  assert.equal(artifact.file.url, "https://blob.test/report.pdf");
  assert.equal(artifact.file.contentType, "application/pdf");
});

test("幂等：同 id manifest 重复事件只出站一次", async () => {
  const manifestId = "22222222-2222-4222-8222-222222222222";
  const { gateway, harness } = makeGateway({
    [`piwork/outbox/${manifestId}.json`]: JSON.stringify({
      filename: "a.txt",
      id: manifestId,
      path: "a.txt",
      size: 2,
    }),
    "a.txt": new TextEncoder().encode("hi"),
  });
  const collected = drain(harness);
  gateway.handleEvent(deliverFileEnd(`piwork/outbox/${manifestId}.json`));
  gateway.handleEvent(deliverFileEnd(`piwork/outbox/${manifestId}.json`));
  await gateway.flush();
  harness.queue.end();
  const events = await collected;
  assert.equal(harness.stored.length, 1);
  assert.equal(
    events.filter((event) => event.type === "artifact.created").length,
    1
  );
});

test("坏 manifest / 读失败 / 超限：容忍不击穿（无出站、flush 不抛）", async () => {
  const bad = "33333333-3333-4333-8333-333333333333";
  const oversize = "44444444-4444-4444-8444-444444444444";
  const { gateway, harness } = makeGateway(
    { [`piwork/outbox/${bad}.json`]: "not-json{" },
    { failRead: (file) => file.endsWith("missing.json") }
  );
  harness.files.set(
    `piwork/outbox/${oversize}.json`,
    new TextEncoder().encode(
      JSON.stringify({
        filename: "big.bin",
        id: oversize,
        path: "big.bin",
        size: 50 * 1024 * 1024 + 1,
      })
    )
  );
  const collected = drain(harness);
  gateway.handleEvent(deliverFileEnd(`piwork/outbox/${bad}.json`));
  gateway.handleEvent(deliverFileEnd("piwork/outbox/missing.json"));
  gateway.handleEvent(deliverFileEnd(`piwork/outbox/${oversize}.json`));
  await gateway.flush();
  harness.queue.end();
  const events = await collected;
  assert.equal(
    events.filter((event) => event.type === "artifact.created").length,
    0
  );
  assert.equal(harness.stored.length, 0);
  assert.equal(harness.archived.length, 0);
});

test("非 deliver_file / isError 事件被忽略", async () => {
  const { gateway, harness } = makeGateway({});
  const ignored: JsonAgentSessionEvent[] = [
    { type: "message_end" } as unknown as JsonAgentSessionEvent,
    {
      isError: true,
      result: { content: [], details: {} },
      toolCallId: "c1",
      toolName: "deliver_file",
      type: "tool_execution_end",
    } as unknown as JsonAgentSessionEvent,
    {
      isError: false,
      result: { content: [], details: {} },
      toolCallId: "c2",
      toolName: "bash",
      type: "tool_execution_end",
    } as unknown as JsonAgentSessionEvent,
  ];
  for (const event of ignored) {
    gateway.handleEvent(event);
  }
  await gateway.flush();
  harness.queue.end();
  await drain(harness);
  assert.equal(harness.stored.length, 0);
});
