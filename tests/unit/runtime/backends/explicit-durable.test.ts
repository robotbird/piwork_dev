import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import { ExplicitDurableRuntimeBackend } from "../../../../lib/runtime/backends/routing/explicit-durable";
import type {
  RuntimeBackend,
  RuntimeSpec,
} from "../../../../lib/runtime/protocol";

test("explicit lane coexists with normal routing, never falls back on denied/failed Durable", async () => {
  let normalCalls = 0;
  let durableCalls = 0;
  const normal: RuntimeBackend = {
    open: () => {
      normalCalls += 1;
      return Promise.reject(new Error("normal-called"));
    },
  };
  const durable: RuntimeBackend = {
    open: () => {
      durableCalls += 1;
      return Promise.reject(new Error("durable-denied"));
    },
  };
  const backend = new ExplicitDurableRuntimeBackend(normal, durable);
  await assert.rejects(backend.open({} as RuntimeSpec), /normal-called/);
  await assert.rejects(
    backend.open({ lane: "default" } as RuntimeSpec),
    /normal-called/
  );
  await assert.rejects(
    backend.open({ lane: "durable_sandbox" } as RuntimeSpec),
    /durable-denied/
  );
  assert.equal(normalCalls, 2);
  assert.equal(durableCalls, 1);
  await assert.rejects(
    new ExplicitDurableRuntimeBackend(normal).open({
      lane: "durable_sandbox",
    } as RuntimeSpec),
    /lane-not-enabled/
  );
  assert.equal(normalCalls, 2);
});
