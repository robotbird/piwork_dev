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

test("explicit file deliveries override even confident lightweight model answers", async () => {
  for (const message of [
    "请将当前目录下的pdf 和图片整理成 场景清单，字段为，场景名称 | 场景说明 | 备注，三个字段，输出excel",
    "把上表导出为 XLSX",
    "整理成Excel",
    "转换成电子表格",
    "输出 PDF",
    "生成可下载的文件",
    "将内容保存为 report.xlsx",
    "export the results as CSV",
    "generate a PowerPoint presentation",
    "读取report.pdf",
  ]) {
    // biome-ignore lint/performance/noAwaitInLoops: sequential routing cases keep per-case assertions and failures isolated
    const decision = await classifyExecution(
      { attachmentCount: 0, history: [], message },
      {
        classify: () => {
          throw new Error(
            "explicit execution must bypass remote classification"
          );
        },
      }
    );
    assert.equal(decision.requiresExecution, true, message);
    assert.equal(decision.reason, "heuristic");
    assert.ok(decision.rule);
  }
});

test("ordinary format questions still use the official classifier", async () => {
  for (const message of [
    "解释 Excel 公式",
    "xlsx和csv有什么区别",
    "如何导出 Excel",
    "不要生成Excel，只解释公式",
    "只输出 CSV 文本",
    "file.xlsx这个名称是什么意思",
  ]) {
    let called = false;
    // biome-ignore lint/performance/noAwaitInLoops: sequential routing cases keep per-case assertions and failures isolated
    const decision = await classifyExecution(
      { attachmentCount: 0, history: [], message },
      {
        classify: () => {
          called = true;
          return Promise.resolve(result("conversation"));
        },
      }
    );
    assert.equal(called, true, message);
    assert.equal(decision.requiresExecution, false, message);
  }
});

test("file follow-ups use recent user intent, not assistant suggestions or unrelated history", async () => {
  for (const message of ["继续", "按刚才的格式再来一份", "重新生成"]) {
    // biome-ignore lint/performance/noAwaitInLoops: sequential routing cases keep per-case assertions and failures isolated
    const decision = await classifyExecution(
      {
        attachmentCount: 0,
        history: [
          { role: "user", text: "整理成场景清单，输出excel" },
          { role: "assistant", text: "建议输出CSV" },
        ],
        message,
      },
      {
        classify: () => {
          throw new Error("continuation must bypass classifier");
        },
      }
    );
    assert.equal(decision.requiresExecution, true);
    assert.equal(decision.rule, "file-follow-up");
  }
  for (const history of [
    [{ role: "assistant", text: "可以生成Excel" }],
    [
      { role: "user", text: "输出Excel" },
      { role: "user", text: "解释机器学习" },
    ],
  ]) {
    // biome-ignore lint/performance/noAwaitInLoops: sequential routing cases keep per-case assertions and failures isolated
    const decision = await classifyExecution(
      { attachmentCount: 0, history, message: "继续" },
      { classify: () => Promise.resolve(result("conversation")) }
    );
    assert.equal(decision.reason, "classified");
    assert.equal(decision.requiresExecution, false);
  }
});
