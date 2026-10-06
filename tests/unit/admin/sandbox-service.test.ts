// biome-ignore-all lint/suspicious/useAwait: asynchronous dependency doubles
import assert from "node:assert/strict";
import test from "node:test";
import type { SandboxInstanceView } from "../../../lib/db/sandbox-queries";
import {
  SandboxAdminError,
  SandboxAdminService,
} from "../../../lib/admin/sandbox-service";
import type { SandboxControl } from "../../../lib/runtime/sandbox";

function harness(overrides: Partial<SandboxControl> = {}) {
  const expiry = new Date(Date.now() + 3_600_000);
  const row: SandboxInstanceView = {
    chatId: "chat",
    chatTitle: "Test task",
    createdAt: new Date(),
    expiresAt: expiry,
    externalId: "sandbox",
    id: "record",
    image: "pi-runtime:dev",
    lastRenewedAt: new Date(),
    lastRunId: "run",
    provider: "opensandbox",
    runtimeConfig: null,
    status: "ready",
    ttlSeconds: 3600,
    userEmail: "owner@test.local",
    userId: "owner",
    userName: null,
  };
  const calls: string[] = [];
  const observed: unknown[] = [];
  const control: SandboxControl = {
    destroy: async () => {
      calls.push("kill");
    },
    extend: async (_id, seconds) => {
      assert.equal(seconds, 3600);
      return {
        expiresAt: new Date(expiry.getTime() + seconds * 1000),
        status: "ready",
      };
    },
    inspect: async () => ({ expiresAt: expiry, status: "ready" }),
    ...overrides,
  };
  const service = new SandboxAdminService({
    control: () => control,
    get: async () => ({ ...row, updatedAt: new Date() }),
    list: async () => [{ ...row }],
    listPage: async (options) => ({
      page: options.page,
      rows: [{ ...row }],
      total: 1,
    }),
    observe: async (_provider, _id, state, renewed) => {
      observed.push({ ...state, renewed });
      row.status = state.status;
      row.expiresAt = state.expiresAt ?? row.expiresAt;
    },
    stopRun: async (chatId, runId) => {
      assert.equal(chatId, "chat");
      assert.equal(runId, "run");
      calls.push("abort");
    },
  });
  return { calls, expiry, observed, row, service };
}

test("provider outage preserves stored state and disables controls", async () => {
  const h = harness({
    inspect: async () => {
      throw new Error("server down");
    },
  });
  const [view] = await h.service.list();
  assert.equal(view.status, "ready");
  assert.equal(view.syncError, true);
  assert.equal(view.controllable, false);
  assert.equal(h.observed.length, 0);
});
test("external destruction is reconciled, missing overdue sandbox is expired", async () => {
  const h = harness({ inspect: async () => null });
  h.row.expiresAt = new Date(Date.now() - 1000);
  const [view] = await h.service.list();
  assert.equal(view.status, "expired");
  assert.equal(view.controllable, false);
  assert.equal(h.observed.length, 1);
});
test("live Docker container is observable after its registry deadline", async () => {
  const h = harness({ inspect: async () => ({ status: "ready" }) });
  h.row.provider = "docker";
  h.row.status = "expired";
  assert.equal((await h.service.list())[0].status, "ready");
});
test("listPage enriches the requested page and echoes paging metadata", async () => {
  const h = harness();
  const result = await h.service.listPage({
    filter: "all",
    page: 2,
    pageSize: 10,
    query: "",
  });
  assert.equal(result.total, 1);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 10);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].syncError, false);
  assert.ok(result.items[0].observedAt);
});
test("destroy aborts the associated run and marks DB only after kill", async () => {
  const h = harness();
  await h.service.act("opensandbox", "sandbox", "destroy");
  assert.deepEqual(h.calls, ["abort", "kill"]);
  assert.equal(h.row.status, "destroyed");
  await h.service.act("opensandbox", "sandbox", "destroy");
  assert.deepEqual(h.calls, ["abort", "kill"]);
});
test("failed kill never marks a live sandbox destroyed", async () => {
  const h = harness({
    destroy: async () => {
      throw new Error("kill failed");
    },
  });
  await assert.rejects(h.service.act("opensandbox", "sandbox", "destroy"));
  assert.equal(h.row.status, "ready");
  assert.equal(h.observed.length, 0);
});
test("renew extends native deadline and updates DB after success", async () => {
  const h = harness();
  await h.service.act("opensandbox", "sandbox", "renew");
  assert.equal(h.row.expiresAt.getTime(), h.expiry.getTime() + 3_600_000);
  const failed = harness({
    extend: async () => {
      throw new Error("renew failed");
    },
  });
  await assert.rejects(failed.service.act("opensandbox", "sandbox", "renew"));
  assert.equal(failed.observed.length, 0);
});
test("missing instance / stopped container cannot be renewed", async () => {
  const h = harness({ inspect: async () => null });
  await assert.rejects(
    h.service.act("opensandbox", "sandbox", "renew"),
    (error) => error instanceof SandboxAdminError && error.status === 409
  );
});
test("overlapping refresh and destroy cannot revive a destroyed instance", async () => {
  let unblock!: () => void;
  const gate = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  const h = harness({
    inspect: async () => {
      await gate;
      return { status: "ready" };
    },
  });
  const refresh = h.service.list();
  const destroy = h.service.act("opensandbox", "sandbox", "destroy");
  unblock();
  await Promise.all([refresh, destroy]);
  assert.equal(h.row.status, "destroyed");
  assert.equal((await h.service.list())[0].status, "destroyed");
});
