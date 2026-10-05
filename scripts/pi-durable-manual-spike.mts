/**
 * pi-durable 手动验证 spike —— docs/pi-durable-evaluation.md §3 的可重放版。
 * 对象：仓库已安装的 @earendil-works/pi-durable（当前 1.0.2，五包对齐；faux provider，无网络依赖）。
 *
 * 运行（仓库根目录）：
 *   pnpm exec tsx scripts/pi-durable-manual-spike.mts all    # 全部用例
 *   pnpm exec tsx scripts/pi-durable-manual-spike.mts t1     # 单跑某个用例（t1..t6）
 *
 * 用例对应关系：
 *   T1 冒烟（MemoryStorage 一问一答）
 *   T2 SQLite 持久化 + 重开延续（close → reopen → 同一会话续问）
 *   T3 恰好一次（同 requestId 重复提交去重）
 *   T4 崩溃恢复 + replay 双重门（kill -9 后 resume；unsafe 工具被 interrupted 拦下）
 *   T5 事件流（watchEvents 快照 + 增量；晚订阅不重放历史派生事件）
 *   T6 双进程单写者（行为观察项：README 声明无跨进程锁）
 *
 * 验证 pi-durable 1.0.2（不动机器内仓库依赖）：
 *   mkdir /tmp/pidurable102 && cd /tmp/pidurable102 && npm init -y
 *   npm install $(npm pack @earendil-works/pi-durable@1.0.2 @earendil-works/pi-ai@1.0.2 @earendil-works/chord@1.0.2 | tr '\n' ' ')
 *   cp <repo>/scripts/pi-durable-manual-spike.mts spike.mts
 *   npx tsx spike.mts all
 */
import { spawn } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BACKGROUND_CONTEXT as CTX } from "@earendil-works/chord/context";
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
  MemoryStorage,
  watchEvents,
} from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

const scriptPath = fileURLToPath(import.meta.url);
/** 仓库根（脚本位于 <repo>/scripts/ 下） */
const repoRoot = path.dirname(path.dirname(scriptPath));
/** 子进程直启 tsx（绕开 pnpm 层；spawn 不走 shell，PATH 内的 pnpm shim 可能不可用） */
const tsxCli = path.join(repoRoot, "node_modules/tsx/dist/cli.mjs");

function spawnSpikeChild(mode: string, arg: string) {
  const child = spawn(process.execPath, [tsxCli, scriptPath, mode, arg], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "inherit"],
  });
  child.on("error", (error) => {
    console.log(
      `  ⚠️  子进程启动失败（${mode}）：${error instanceof Error ? error.message : String(error)}`
    );
  });
  return child;
}

// ---------- 基础设施 ----------

let passed = 0;
let failed = 0;

function ok(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${label}`);
  }
}

function info(label: string): void {
  console.log(`  ℹ️  ${label}`);
}

async function waitFor(
  predicate: () => Promise<boolean> | boolean,
  timeoutMs: number,
  label: string
): Promise<void> {
  const start = Date.now();
  for (;;) {
    // biome-ignore lint/performance/noAwaitInLoops: 轮询谓词，必须逐次等待
    if (await predicate()) {
      return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timeout after ${timeoutMs}ms: ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function bodyOf(view: { entries: readonly unknown[] }): string {
  return JSON.stringify(view.entries);
}

function countOf(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** faux provider + registry + 工具装配（与仓库 DurableBackend 原型同构） */
function makeDeps(
  responses: Parameters<ReturnType<typeof fauxProvider>["setResponses"]>[0],
  tools: unknown[] = []
) {
  const models = createModels();
  const faux = fauxProvider();
  models.setProvider(faux.provider);
  const registry = createRegistry();
  registry.install(defineExtension({ name: "spike", tools: tools as never }));
  faux.setResponses(responses);
  return { faux, models, registry };
}

function harnessOptions(deps: ReturnType<typeof makeDeps>) {
  return {
    models: deps.models,
    registry: deps.registry,
    settings: { toolExecution: "sequential" as const },
  };
}

function modelOf(deps: ReturnType<typeof makeDeps>) {
  const model = deps.faux.models[0];
  if (!model) {
    throw new Error("faux provider 未提供模型定义");
  }
  return { model: { modelId: model.id, provider: model.provider } };
}

// ---------- T1 冒烟 ----------

async function t1(): Promise<void> {
  console.log("\nT1 冒烟：MemoryStorage 一问一答");
  const deps = makeDeps([fauxAssistantMessage("durable 冒烟回复 OK")]);
  const harness = await Harness.open(
    new MemoryStorage(),
    harnessOptions(deps),
    CTX
  );
  const conv = await harness.root(CTX);
  await conv.configure(modelOf(deps), CTX);
  const submission = await conv.submit({ content: "ping", type: "input" }, CTX);
  const settled = (await submission.wait(CTX)) as unknown;
  const view = await conv.context(CTX);
  const body = bodyOf(view);
  console.log(
    `  conversation=${conv.id} entries=${view.entries.length} settled=${JSON.stringify(settled)?.slice(0, 120)}`
  );
  ok(body.includes("ping"), "T1 用户输入已入转录");
  ok(body.includes("durable 冒烟回复 OK"), "T1 助手回复已入转录");
  await harness.close(CTX);
}

// ---------- T2 SQLite 持久化 + 重开延续 ----------

async function t2(root: string): Promise<void> {
  console.log("\nT2 SQLite 持久化：close → 重开 → 同一会话续问");
  const db = path.join(root, "t2.sqlite");
  let conversationId = "";
  {
    const storage = await openNodeSqliteStorage(db);
    const deps = makeDeps([fauxAssistantMessage("第一轮：SQLite 持久化内容")]);
    const harness = await Harness.open(storage, harnessOptions(deps), CTX);
    const conv = await harness.root(CTX);
    await conv.configure(modelOf(deps), CTX);
    await (await conv.submit({ content: "第一问", type: "input" }, CTX)).wait(
      CTX
    );
    conversationId = conv.id;
    await harness.close(CTX);
    await storage.close(CTX);
  }
  {
    const storage = await openNodeSqliteStorage(db);
    const deps = makeDeps([fauxAssistantMessage("第二轮：重开延续内容")]);
    const harness = await Harness.open(storage, harnessOptions(deps), CTX);
    const conv = await harness.root(CTX);
    ok(
      conv.id === conversationId,
      `T2 重开后 root() 返回同一会话（${conv.id}）`
    );
    const before = bodyOf(await conv.context(CTX));
    ok(
      before.includes("第一轮：SQLite 持久化内容"),
      "T2 第一轮回复从 SQLite 恢复"
    );
    await conv.configure(modelOf(deps), CTX);
    await (await conv.submit({ content: "第二问", type: "input" }, CTX)).wait(
      CTX
    );
    const after = bodyOf(await conv.context(CTX));
    ok(after.includes("第二轮：重开延续内容"), "T2 重开后可继续对话并落盘");
    await harness.close(CTX);
    await storage.close(CTX);
  }
}

// ---------- T3 恰好一次 ----------

async function t3(): Promise<void> {
  console.log("\nT3 恰好一次：同 requestId 重复提交");
  const deps = makeDeps([fauxAssistantMessage("T3 恰好一次回复")]);
  const harness = await Harness.open(
    new MemoryStorage(),
    harnessOptions(deps),
    CTX
  );
  const conv = await harness.root(CTX);
  await conv.configure(modelOf(deps), CTX);
  const draft = {
    content: "T3 只应出现一次",
    requestId: "spike-t3-fixed",
    type: "input",
  } as const;
  const first = await conv.submit(draft, CTX);
  await first.wait(CTX);
  const second = await conv.submit({ ...draft }, CTX);
  ok(
    second.id === first.id,
    `T3 同 requestId 返回同一 submission（${first.id}）`
  );
  const body = bodyOf(await conv.context(CTX));
  ok(
    countOf(body, "T3 只应出现一次") === 1,
    "T3 用户条目恰好一条（未重复提交）"
  );
  await harness.close(CTX);
}

// ---------- T4 崩溃恢复 + replay 双重门 ----------

function t4Tools(effectsPath: string) {
  return [
    {
      description: "fast safe tool（崩溃前应已完成，恢复后不得重放）",
      execute: async () => {
        await appendFile(effectsPath, "pre-ran\n");
        return { content: [{ text: "pre-ok", type: "text" }] };
      },
      name: "pre_safe",
      parameters: Type.Object({}),
      replay: "safe" as const,
    },
    {
      description:
        "slow unsafe tool（崩溃时正在执行，恢复后必须 interrupted 不重放）",
      execute: async () => {
        await appendFile(effectsPath, "unsafe-ran\n");
        await sleep(120_000);
        return { content: [{ text: "slow-ok", type: "text" }] };
      },
      name: "slow_unsafe",
      parameters: Type.Object({}),
      replay: "unsafe" as const,
    },
  ];
}

/** t4 子进程模式：提交后挂住，等父进程 SIGKILL（模拟进程崩溃，不走 close） */
async function t4Child(root: string): Promise<void> {
  const effectsPath = path.join(root, "effects");
  const deps = makeDeps(
    [
      fauxAssistantMessage([fauxToolCall("pre_safe", {})], {
        stopReason: "toolUse",
      }),
      fauxAssistantMessage([fauxToolCall("slow_unsafe", {})], {
        stopReason: "toolUse",
      }),
      fauxAssistantMessage("T4 恢复完成"),
    ],
    t4Tools(effectsPath)
  );
  const storage = await openNodeSqliteStorage(path.join(root, "t4.sqlite"));
  const harness = await Harness.open(storage, harnessOptions(deps), CTX);
  const conv = await harness.root(CTX);
  await conv.configure(modelOf(deps), CTX);
  const trace = await watchEvents(harness, conv.id, CTX);
  await trace.start(
    // biome-ignore lint/suspicious/useAwait: 官方 listener 契约要求 Promise 返回，此处纯同步收集
    async (events) => {
      for (const event of events) {
        const detail =
          event.type === "message_end" || event.type === "message_start"
            ? ` ${JSON.stringify((event as { message?: unknown }).message)?.slice(0, 200)}`
            : "";
        console.error(`[child] ${event.type}${detail}`);
      }
    }
  );
  await conv.submit(
    { content: "T4 依次调用 pre_safe 和 slow_unsafe", type: "input" },
    CTX
  );
  await writeFile(path.join(root, "t4-ready"), "1");
  await new Promise(() => undefined);
}

async function t4(): Promise<void> {
  console.log("\nT4 崩溃恢复：kill -9 后重开 resume，replay 双重门");
  const root = await mkdtemp(path.join(tmpdir(), "pidurable-t4-"));
  const effectsPath = path.join(root, "effects");
  const child = spawnSpikeChild("t4-child", root);
  try {
    await waitFor(
      () =>
        readFile(path.join(root, "t4-ready"))
          .then(() => true)
          .catch(() => false),
      60_000,
      "t4-child ready"
    );
    await waitFor(
      () =>
        readFile(effectsPath)
          .then((b) => b.includes("unsafe-ran"))
          .catch(() => false),
      60_000,
      "slow_unsafe 开始执行"
    );
    child.kill("SIGKILL");
    await new Promise<void>((resolve) => child.on("exit", () => resolve()));
    const afterCrash = await readFile(effectsPath, "utf8");
    ok(
      afterCrash === "pre-ran\nunsafe-ran\n",
      `T4 崩溃时副作用恰好各一次：${JSON.stringify(afterCrash)}`
    );

    // 重开：同一路径 SQLite + 同名同 replay 的工具注册（按名重绑）
    const storage = await openNodeSqliteStorage(path.join(root, "t4.sqlite"));
    const deps = makeDeps(
      [fauxAssistantMessage("T4 恢复完成")],
      t4Tools(effectsPath)
    );
    const harness = await Harness.open(storage, harnessOptions(deps), CTX);
    const conv = await harness.root(CTX);
    harness.resume();
    await waitFor(
      async () => bodyOf(await conv.context(CTX)).includes("T4 恢复完成"),
      60_000,
      "generation 续跑至收尾"
    );
    const body = bodyOf(await conv.context(CTX));
    const effectsAfter = await readFile(effectsPath, "utf8");
    ok(
      countOf(effectsAfter, "unsafe-ran") === 1,
      "T4 unsafe 工具未重放（interrupted 门禁）"
    );
    ok(
      countOf(effectsAfter, "pre-ran") === 1,
      "T4 已完成的 safe 工具不重复执行"
    );
    ok(body.includes("interrupted"), "T4 模型收到 interrupted 错误结果");
    ok(body.includes("T4 恢复完成"), "T4 generation 从 checkpoint 续跑到收尾");
    await harness.close(CTX);
    await storage.close(CTX);
  } finally {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
    await rm(root, { force: true, recursive: true });
  }
}

// ---------- T5 事件流 ----------

async function t5(): Promise<void> {
  console.log("\nT5 事件流：watchEvents 快照 + 增量 + 晚订阅");
  const deps = makeDeps([fauxAssistantMessage("T5 事件流回复")]);
  const harness = await Harness.open(
    new MemoryStorage(),
    harnessOptions(deps),
    CTX
  );
  const conv = await harness.root(CTX);
  await conv.configure(modelOf(deps), CTX);

  const types: string[] = [];
  const stream = await watchEvents(harness, conv.id, CTX);
  await stream.start(
    // biome-ignore lint/suspicious/useAwait: 官方 listener 契约要求 Promise 返回，此处纯同步收集
    async (batch) => {
      for (const event of batch) {
        types.push(event.type);
      }
    }
  );
  ok(stream.snapshot !== undefined, "T5 附加时拿到原子快照句柄");
  await (
    await conv.submit({ content: "T5 触发一轮", type: "input" }, CTX)
  ).wait(CTX);
  await stream.stop();
  const unique = [...new Set(types)];
  console.log(`  事件类型：${unique.join(", ")}`);
  ok(types.includes("run_end"), "T5 收到 run_end 终态事件");

  // 晚订阅：快照来自句柄属性；增量流只推后续提交，不重放历史派生事件
  const lateTypes: string[] = [];
  const late = await watchEvents(harness, conv.id, CTX);
  await late.start(
    // biome-ignore lint/suspicious/useAwait: 官方 listener 契约要求 Promise 返回，此处纯同步收集
    async (batch) => {
      for (const event of batch) {
        lateTypes.push(event.type);
      }
    }
  );
  await sleep(500);
  await late.stop();
  const lateBody = JSON.stringify(late.snapshot);
  ok(
    late.snapshot !== undefined && lateBody.includes("T5 触发一轮"),
    "T5 晚订阅快照携带完整历史（含提交前消息）"
  );
  ok(!lateTypes.includes("message_start"), "T5 晚订阅未重放历史派生事件");
  await harness.close(CTX);
}

// ---------- T6 双进程单写者（行为观察项） ----------

async function t6Holder(db: string): Promise<void> {
  const storage = await openNodeSqliteStorage(db);
  const deps = makeDeps([]);
  const harness = await Harness.open(storage, harnessOptions(deps), CTX);
  await harness.root(CTX);
  await writeFile(path.join(path.dirname(db), "t6-holder-ready"), "1");
  await new Promise(() => undefined);
}

async function t6(root: string): Promise<void> {
  console.log("\nT6 双进程单写者（README：无跨进程锁，纯约定）");
  const db = path.join(root, "t6.sqlite");
  {
    const seed = await openNodeSqliteStorage(db);
    await seed.close(CTX);
  }
  const holder = spawnSpikeChild("t6-holder", db);
  try {
    await waitFor(
      () =>
        readFile(path.join(root, "t6-holder-ready"))
          .then(() => true)
          .catch(() => false),
      60_000,
      "holder ready"
    );
    let outcome: string;
    try {
      const storage = await openNodeSqliteStorage(db);
      const deps = makeDeps([fauxAssistantMessage("T6 第二进程写入")]);
      const harness = await Harness.open(storage, harnessOptions(deps), CTX);
      const conv = await harness.root(CTX);
      await conv.configure(modelOf(deps), CTX);
      const submission = await conv.submit(
        { content: "T6 第二进程写入", type: "input" },
        CTX
      );
      await Promise.race([
        submission.wait(CTX),
        sleep(20_000).then(() => {
          throw new Error("second-writer wait timeout");
        }),
      ]);
      await harness.close(CTX);
      await storage.close(CTX);
      outcome = "第二个进程 open+submit 未被阻止";
    } catch (error) {
      outcome = `第二个进程被拒绝/失败：${error instanceof Error ? error.message : String(error)}`;
    }
    if (outcome.includes("未被阻止")) {
      info(
        `${outcome} —— 符合 README「单写者纯约定」：部署必须外部仲裁（DB 租约/单实例），这是设计约束不是缺陷`
      );
    } else {
      ok(true, outcome);
    }
  } finally {
    if (!holder.killed) {
      holder.kill("SIGKILL");
    }
    await rm(root, { force: true, recursive: true });
  }
}

// ---------- 入口 ----------

async function main(): Promise<void> {
  const command = process.argv[2] ?? "all";
  // 子进程模式（由 t4/t6 内部 spawn，不对外使用）
  if (command === "t4-child") {
    const [, , , root] = process.argv;
    if (!root) {
      throw new Error("t4-child 缺少 root 参数");
    }
    return t4Child(root);
  }
  if (command === "t6-holder") {
    const [, , , db] = process.argv;
    if (!db) {
      throw new Error("t6-holder 缺少 db 参数");
    }
    return t6Holder(db);
  }
  console.log(
    "pi-durable 手动验证 spike（@earendil-works/pi-durable@0.99.2 安装版，faux provider）"
  );
  const tempRoots: string[] = [];
  const newRoot = async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pidurable-spike-"));
    tempRoots.push(root);
    return root;
  };
  const run = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      failed += 1;
      console.log(
        `  ❌ ${name} 异常：${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
  try {
    if (command === "all" || command === "t1") {
      await run("T1", t1);
    }
    if (command === "all" || command === "t2") {
      await run("T2", async () => t2(await newRoot()));
    }
    if (command === "all" || command === "t3") {
      await run("T3", t3);
    }
    if (command === "all" || command === "t4") {
      await run("T4", t4);
    }
    if (command === "all" || command === "t5") {
      await run("T5", t5);
    }
    if (command === "all" || command === "t6") {
      await run("T6", async () => t6(await newRoot()));
    }
  } finally {
    for (const root of tempRoots) {
      // biome-ignore lint/performance/noAwaitInLoops: 顺序清理临时目录，数量极少
      await rm(root, { force: true, recursive: true });
    }
  }
  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();
