import assert from "node:assert/strict";
import test from "node:test";
import { heuristicExecution } from "../../../lib/ai/execution-heuristic";

test("greetings and text writing need no execution", () => {
  for (const message of [
    "你好",
    "hello!",
    "帮我写一首诗",
    "draft an email",
    "解释一下什么是机器学习",
  ]) {
    assert.equal(
      heuristicExecution({ attachmentCount: 0, history: [], message })
        .requiresExecution,
      false,
      message
    );
  }
});

test("Chinese execution and English router code intent require execution", () => {
  for (const message of [
    "运行 Python 分析数据",
    "生成一个 Excel 文件",
    "用浏览器搜索新闻",
    "调用 MCP",
    "执行这个技能",
    "implement a function",
    "create a PDF file",
  ]) {
    assert.equal(
      heuristicExecution({ attachmentCount: 0, history: [], message })
        .requiresExecution,
      true,
      message
    );
  }
});

test("attachments and execution continuations stay isolated; a fresh greeting is lightweight", () => {
  const history = [{ role: "user", text: "运行 Python 分析数据" }];
  assert.equal(
    heuristicExecution({ attachmentCount: 0, history, message: "继续" })
      .requiresExecution,
    true
  );
  assert.equal(
    heuristicExecution({ attachmentCount: 0, history, message: "你好" })
      .requiresExecution,
    false
  );
  assert.equal(
    heuristicExecution({ attachmentCount: 1, history: [], message: "总结一下" })
      .requiresExecution,
    true
  );
});
