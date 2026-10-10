import "../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import type { ClassifierResult } from "@earendil-works/pi-ai";
import {
  classifyExecution,
  executionDecision,
} from "../../../lib/ai/execution-classifier";

function result(choice: string, confidence = 0.95): ClassifierResult {
  return {
    answers: {
      execution: {
        choice,
        confidence,
        probabilities: { [choice]: confidence },
        type: "choice",
      },
    },
    api: "typesafe-system-one",
    model: "jev-latest",
    provider: "typesafe",
    stopReason: "stop",
    timestamp: 0,
  };
}

test("only confident non-execution answers permit lightweight runs", () => {
  assert.equal(
    executionDecision(result("conversation")).requiresExecution,
    false
  );
  assert.equal(
    executionDecision(result("platform_tools")).requiresExecution,
    false
  );
  for (const answer of [
    result("workspace_execution"),
    result("conversation", 0.5),
    result("invented"),
    result("conversation", Number.NaN),
    { ...result("conversation"), stopReason: "error" as const },
    { ...result("conversation"), answers: {} },
  ]) {
    assert.equal(executionDecision(answer).requiresExecution, true);
  }
});

test("official classifier receives bounded context and timeout; failure is conservative", async () => {
  const input = {
    attachmentCount: 0,
    history: [{ role: "assistant", text: "a".repeat(3000) }],
    message: "你好",
  };
  const decision = await classifyExecution(input, {
    classify: (context, signal) => {
      assert.equal(context.state.message, "你好");
      assert.equal(
        JSON.stringify(context.state.history).includes("a".repeat(1501)),
        false
      );
      assert.ok(signal instanceof AbortSignal);
      assert.equal(context.questions.execution.type, "choice");
      return Promise.resolve(result("conversation"));
    },
  });
  assert.equal(decision.requiresExecution, false);
  assert.equal(
    (
      await classifyExecution(input, {
        classify: () => Promise.reject(new Error("offline")),
      })
    ).requiresExecution,
    true
  );
  assert.equal(
    (await classifyExecution(input, { modelRef: "not-a-classifier" }))
      .requiresExecution,
    true
  );
});

test("unconfigured classifier routes the reported time.txt request to execution", async () => {
  const decision = await classifyExecution(
    {
      attachmentCount: 0,
      history: [],
      message: "请获取当前服务器时间 写入time.txt",
    },
    { modelRef: "" }
  );
  assert.equal(decision.reason, "heuristic");
  assert.equal(decision.requiresExecution, true);
});

test("request cancellation propagates instead of starting execution", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    classifyExecution(
      {
        attachmentCount: 0,
        history: [],
        message: "你好",
        signal: controller.signal,
      },
      { classify: async () => result("conversation") }
    )
  );
});

test("unconfigured model uses local pi-auto-router; configured model takes priority", async () => {
  const input = { attachmentCount: 0, history: [], message: "你好" };
  assert.equal(
    (await classifyExecution(input, { modelRef: "" })).requiresExecution,
    false
  );
  assert.equal(
    (await classifyExecution(input, { modelRef: "" })).reason,
    "heuristic"
  );
  const decision = await classifyExecution(input, {
    classify: () => Promise.resolve(result("workspace_execution")),
    modelRef: "typesafe/jev-latest",
  });
  assert.equal(decision.requiresExecution, true);
  assert.equal(decision.reason, "classified");
});
