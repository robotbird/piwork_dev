/**
 * pi-durable 交互演示：一个"可以被 kill 的持久对话"终端程序。
 * 无需模型密钥（faux 伪大脑按输入关键词路由）；数据存 .piwork/durable-demo/（已 gitignore）。
 *
 * 运行：pnpm exec tsx scripts/pi-durable-demo.mts
 *
 * 演示玩法：
 *  1. 持久化：聊几句 → /exit → 重新启动 → 历史都在
 *  2. 崩溃恢复：输入「慢任务 60」→ 趁它执行时另开终端
 *     pkill -9 -f pi-durable-demo → 重新启动 → 自动续跑（unsafe 工具不重放，模型收到 interrupted 重新规划）
 *  3. safe 重放：输入「慢记「要点」30」→ kill -9 → 重启 → 笔记仍被写入且只写一次
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface as createLineInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { BACKGROUND_CONTEXT as CTX } from "@earendil-works/chord/context";
import type {
  AssistantMessage,
  TranscriptContext,
} from "@earendil-works/pi-ai";
import {
  createModels,
  fauxAssistantMessage,
  fauxToolCall,
  Type,
} from "@earendil-works/pi-ai";
import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import {
  createRegistry,
  defineExtension,
  Harness,
  watchEvents,
} from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.join(repoRoot, ".piwork/durable-demo");
const db = path.join(dir, "demo.sqlite");
const notesFile = path.join(dir, "notes.md");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- 伪大脑：按最后一条用户输入路由 ----------

function lastUserText(ctx: TranscriptContext): string {
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    const message = ctx.messages[i];
    if (message?.role !== "user") {
      continue;
    }
    if (typeof message.content === "string") {
      return message.content;
    }
    return message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");
  }
  return "";
}

function brain(ctx: TranscriptContext): AssistantMessage {
  const reply = (text: string) =>
    fauxAssistantMessage(text, { stopReason: "stop" });
  // 工具轮结束后尾部是 toolResult：应给最终答复而不是再次发起同一工具调用
  const last = ctx.messages[ctx.messages.length - 1];
  if (last?.role === "toolResult") {
    const failed = (last as { isError?: boolean }).isError === true;
    return failed
      ? reply("⚠️ 收到错误工具结果（可能被崩溃恢复中断），可以重新下发指令。")
      : reply("已完成。可以 /notes 查看笔记，或继续聊。");
  }
  const text = lastUserText(ctx);
  const seconds = text.match(/(\d+)\s*(秒|s|秒钟)?/)?.[1];
  const quoted = text.match(/[「“"](.+?)[」”"]/)?.[1];
  if (/慢任务|slow task/i.test(text)) {
    return fauxAssistantMessage(
      [fauxToolCall("slow_task", { seconds: seconds ? Number(seconds) : 30 })],
      { stopReason: "toolUse" }
    );
  }
  if (/慢记/.test(text)) {
    return fauxAssistantMessage(
      [
        fauxToolCall("slow_note", {
          seconds: seconds ? Number(seconds) : 20,
          text: quoted ?? text,
        }),
      ],
      { stopReason: "toolUse" }
    );
  }
  if (/记|note/i.test(text)) {
    return fauxAssistantMessage(
      [fauxToolCall("note", { text: quoted ?? text })],
      { stopReason: "toolUse" }
    );
  }
  return reply(`收到：“${text}”。试试：慢任务 30 · 慢记「要点」30 · 记「abc」`);
}

/** 每次 pi-durable 发起模型请求前，动态注入一个按当前对话生成的响应 */
function withBrain(handle: ReturnType<typeof fauxProvider>) {
  const inject = (where: string, context: TranscriptContext) => {
    if (process.env.PIWORK_DEMO_DEBUG) {
      console.log(`  🔍 模型请求(${where})，消息数=${context.messages.length}`);
    }
    handle.setResponses([brain(context)]);
  };
  return {
    ...handle.provider,
    stream: (model, context, options) => {
      inject("stream", context);
      return handle.provider.stream(model, context, options);
    },
    streamSimple: (model, context, options) => {
      inject("streamSimple", context);
      return handle.provider.streamSimple(model, context, options);
    },
  };
}

// ---------- 工具面（replay 语义是演示重点） ----------

function demoTools() {
  return [
    {
      description: "立即记一条笔记（safe：崩溃重放也不产生重复内容）",
      execute: async (args: { text: string }) => {
        await appendFile(notesFile, `- ${args.text}\n`);
        return { content: [{ text: "已记录", type: "text" }] };
      },
      name: "note",
      parameters: Type.Object({ text: Type.String() }),
      replay: "safe" as const,
    },
    {
      description: "慢速记笔记（safe：先耗时再写入，供演示崩溃后 safe 重放）",
      execute: async (args: { text: string; seconds: number }) => {
        await sleep(args.seconds * 1000);
        await appendFile(notesFile, `- ${args.text}\n`);
        return {
          content: [{ text: `已记录（耗时 ${args.seconds}s）`, type: "text" }],
        };
      },
      name: "slow_note",
      parameters: Type.Object({ seconds: Type.Number(), text: Type.String() }),
      replay: "safe" as const,
    },
    {
      description:
        "慢任务（unsafe：任意副作用不可假设幂等；崩溃后 interrupted 不重放）",
      execute: async (args: { seconds: number }) => {
        await sleep(args.seconds * 1000);
        return {
          content: [{ text: `慢任务完成（${args.seconds}s）`, type: "text" }],
        };
      },
      name: "slow_task",
      parameters: Type.Object({ seconds: Type.Number() }),
      replay: "unsafe" as const,
    },
  ];
}

// ---------- 事件打印 ----------

function textOfMessage(message: unknown): string {
  const m = message as { content?: unknown };
  if (typeof m?.content === "string") {
    return m.content;
  }
  if (Array.isArray(m?.content)) {
    return (m.content as { type: string; text?: string }[])
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");
  }
  return "";
}

async function printEvent(event: {
  type: string;
  [key: string]: unknown;
}): Promise<void> {
  switch (event.type) {
    case "tool_execution_start":
      console.log(
        `  🔧 ${event.toolName}(${JSON.stringify(event.args ?? {}).slice(0, 80)}) 执行中…`
      );
      break;
    case "tool_execution_end": {
      const entry = event.entry as
        | { model?: [{ role?: string; isError?: boolean; content?: unknown }] }
        | undefined;
      const result = entry?.model?.[0];
      const failed = result?.isError === true;
      const text = textOfMessage(result).slice(0, 120);
      console.log(
        `  ${failed ? "⚠️" : "✔"} ${event.toolName} 结束${failed ? "（错误结果，可能为恢复中断 interrupted）" : ""}${text ? `：${text}` : ""}`
      );
      break;
    }
    case "message_start": {
      const role = (event.message as { role?: string } | undefined)?.role;
      if (role === "assistant") {
        console.log("🤖 回复中…");
      }
      break;
    }
    case "message_end": {
      if (process.env.PIWORK_DEMO_DEBUG) {
        console.log(
          `  🔍 ${event.type}: ${JSON.stringify(event).slice(0, 220)}`
        );
      }
      const entry = event.entry as
        | { model?: [{ role?: string; content?: unknown }] }
        | undefined;
      const message = entry?.model?.[0];
      if (message?.role !== "assistant") {
        break;
      }
      const calls = (
        message.content as { type: string; name?: string }[] | undefined
      )?.filter((part) => part.type === "toolCall");
      if (calls && calls.length > 0) {
        console.log(
          `  → 请求工具：${calls.map((call) => call.name).join(", ")}`
        );
      } else {
        const text = textOfMessage(message).trim();
        if (text) {
          console.log(`🤖 ${text}`);
        }
      }
      break;
    }
    case "run_end":
      console.log("── 回合结束\n");
      break;
    default:
      break;
  }
}

// ---------- 主程序 ----------

async function main(): Promise<void> {
  await mkdir(dir, { recursive: true });
  const storage = await openNodeSqliteStorage(db);
  const handle = fauxProvider();
  const models = createModels();
  models.setProvider(withBrain(handle) as typeof handle.provider);
  const registry = createRegistry();
  registry.install(
    defineExtension({ name: "demo", tools: demoTools() as never })
  );

  const harness = await Harness.open(
    storage,
    { models, registry, settings: { toolExecution: "sequential" } },
    CTX
  );
  const conv = await harness.root(CTX);
  const model = handle.models[0];
  if (!model) {
    throw new Error("faux provider 未提供模型定义");
  }
  await conv.configure(
    { model: { modelId: model.id, provider: model.provider } },
    CTX
  );
  harness.resume(); // 恢复上次崩溃遗留的未完任务（若有）

  const view = await conv.context(CTX);
  const roles = view.entries
    .map((entry) => (entry as { model?: [{ role?: string }] }).model?.[0]?.role)
    .filter(Boolean);
  console.log("═══ pi-durable 交互演示 ═══");
  console.log(`存储：${path.relative(repoRoot, db)}（SQLite，跨重启）`);
  console.log(
    `历史：${roles.length} 条消息（user ${roles.filter((r) => r === "user").length} / assistant ${roles.filter((r) => r === "assistant").length}）`
  );
  console.log(
    "指令：直接输入聊天 · /notes 看笔记 · /history 转录统计 · /exit 优雅退出 · Ctrl+C 模拟崩溃"
  );
  console.log("试试：慢任务 30 · 慢记「要点」30 · 记「abc」\n");

  let runInFlight = false;
  let resolveRun: (() => void) | undefined;
  const stream = await watchEvents(harness, conv.id, CTX);
  await stream.start(async (events) => {
    for (const event of events) {
      if (event.type === "run_start") {
        runInFlight = true;
      }
      if (event.type === "run_end") {
        runInFlight = false;
        resolveRun?.();
        resolveRun = undefined;
      }
      await printEvent(event);
    }
  });

  let exiting = false;
  const gracefulExit = async () => {
    if (exiting) {
      return;
    }
    exiting = true;
    console.log(
      "优雅退出：停止事件流并 close Harness 与存储（对照：Ctrl+C 是不做清理的崩溃）"
    );
    await stream.stop();
    await harness.close(CTX);
    await storage.close(CTX);
    process.exit(0);
  };

  // readline promises 的 question() 在管道下第二次调用收不到行（Node 26 实测），
  // 故用事件式 line 监听（TTY 与管道下行为一致）
  const rl = createLineInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const lines: string[] = [];
  let lineArrived: (() => void) | undefined;
  let inputClosed = false;
  rl.on("line", (line) => {
    lines.push(line);
    lineArrived?.();
    lineArrived = undefined;
  });
  rl.on("SIGINT", () => {
    // 演示核心：Ctrl+C = 模拟进程崩溃，不做任何清理（close 语义对照见 /exit）
    console.log("\n[模拟崩溃：进程直接退出，不做清理。重新启动即可看到恢复]");
    process.exit(130);
  });
  rl.on("close", () => {
    inputClosed = true;
    lineArrived?.();
    lineArrived = undefined;
  });

  async function readLine(prompt: string): Promise<string | undefined> {
    process.stdout.write(prompt);
    while (lines.length === 0) {
      if (inputClosed) {
        return; // EOF：交给优雅退出
      }
      await new Promise<void>((resolve) => {
        lineArrived = resolve;
      });
    }
    return lines.shift();
  }

  for (;;) {
    const line = await readLine(runInFlight ? "…(回合进行中) > " : "you> ");
    if (line === undefined) {
      await gracefulExit();
      return;
    }
    if (line === "/exit") {
      rl.close();
      await gracefulExit();
      return;
    }
    if (line === "/notes") {
      console.log(
        await readFile(notesFile, "utf8").catch(() => "(笔记文件还不存在)")
      );
      continue;
    }
    if (line === "/history") {
      console.log(`当前转录 ${roles.length} 条消息；笔记文件：${notesFile}`);
      continue;
    }
    if (!line.trim()) {
      continue;
    }
    if (runInFlight) {
      console.log("当前回合仍在进行，请稍候（或等工具结束后再输入）");
      continue;
    }
    const turned = new Promise<void>((resolve) => {
      resolveRun = resolve;
    });
    if (process.env.PIWORK_DEMO_DEBUG) {
      console.log(`  🔍 提交: ${line.slice(0, 40)}`);
    }
    await conv.submit({ content: line, type: "input" }, CTX);
    await turned;
  }
}

await main();
