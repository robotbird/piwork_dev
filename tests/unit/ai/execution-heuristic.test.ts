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
    "帮我写一篇文章",
    "time.txt 这个名称是什么意思？",
    "Explain the meaning of config.yaml",
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

test("Chinese writes and named text/config file operations require execution", () => {
  for (const message of [
    "请获取当前服务器时间 写入time.txt",
    "把当前时间写到 time.txt",
    "将结果存入日志",
    "请将当前时间保存到time.txt",
    "读取time.txt",
    "新建 config.json",
    "追加今天的记录到notes.md",
    "write the current time to time.txt",
    "save the result to config.yaml",
    "read time.txt",
  ]) {
    for (const platformWebSearch of [false, true]) {
      assert.equal(
        heuristicExecution({
          attachmentCount: 0,
          history: [],
          message,
          platformWebSearch,
        }).requiresExecution,
        true,
        message
      );
    }
  }
});

test("file continuations remain execution tasks even when the next request is web search", () => {
  const history = [{ role: "user", text: "请获取当前服务器时间 写入time.txt" }];
  for (const message of ["继续", "查询最新新闻"]) {
    assert.equal(
      heuristicExecution({
        attachmentCount: 0,
        history,
        message,
        platformWebSearch: true,
      }).requiresExecution,
      true
    );
  }
  assert.equal(
    heuristicExecution({
      attachmentCount: 0,
      history,
      message: "你好",
      platformWebSearch: true,
    }).requiresExecution,
    false
  );
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
