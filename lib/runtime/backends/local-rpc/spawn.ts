import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RpcClientOptions } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { MANAGED_AGENT_DIR } from "@/lib/pi-packages/manager";
import type { RuntimeSpec } from "../../protocol";

/** LocalRpcBackend 构造选项；测试经 env/extensions 注入 faux provider（§3.5） */
export type LocalRpcBackendOptions = {
  /** pi CLI 入口绝对路径；默认解析包内 dist/bundle/cli.js（bin 字段同源） */
  cliPath?: string;
  /** 子进程 PI_CODING_AGENT_DIR；缺省每次 open() 独立 mkdtemp（隔离 stray 扩展/凭据） */
  agentDir?: string;
  /** 会话文件目录；缺省每次 open() 独立 mkdtemp */
  sessionDir?: string;
  /** 追加子进程 env（如 PIWORK_FAUX_SCRIPT）；覆盖默认派生值 */
  env?: Record<string, string>;
  /** --extension 绝对路径列表（可重复 flag；测试传 faux 扩展，Step 4 传 bridge） */
  extensions?: string[];
};

/**
 * 解析包内 CLI bundle 绝对路径。包 exports map 的 "." 只定义 import 条件
 * （CJS require.resolve 报 ERR_PACKAGE_PATH_NOT_EXPORTED），走 ESM 解析器；
 * RpcClient 默认 cliPath 是相对路径 "dist/cli.js"（相对父进程 cwd，几乎
 * 必然解析失败），必须显式传绝对路径。
 */
export function resolveDefaultCliPath(): string {
  const mainEntry = fileURLToPath(
    import.meta.resolve("@earendil-works/pi-coding-agent")
  );
  return path.join(path.dirname(mainEntry), "bundle", "cli.js");
}

/**
 * 把 spec.historyMessages 落成 Pi 会话文件（§8.2 会话文件 seeding）并返回
 * 路径：SessionManager.create + appendMessage（v3 JSONL，含 header），
 * 子进程以 --session <file> 加载。
 *
 * 落盘时机是 pi 的 _persist 规则：fileEntries 含 assistant 消息才写文件，
 * 此前全部驻留内存——非空历史（既往轮次必含 assistant）会整批 flush；空
 * 历史不落文件也无妨：--session 传绝对路径时缺失文件是合法的（main.js
 * resolveSessionPath 的 "path" 分支不做存在性检查，SessionManager 以新会
 * 话绑定该路径起步）。已知边界：纯 user 历史不落盘、不会抵达子进程。
 */
export function seedSessionFile(
  spec: RuntimeSpec,
  sessionDir: string,
  runtimeCwd = spec.workspaceDir ?? MANAGED_AGENT_DIR
): string {
  // The persisted header belongs to the target runtime, not the host staging directory.
  // Pi 1.1.0 refuses to open a session whose recorded cwd does not exist there.
  const manager = SessionManager.create(runtimeCwd, sessionDir);
  for (const message of spec.historyMessages) {
    manager.appendMessage(message);
  }
  const file = manager.getSessionFile();
  if (!file) {
    throw new Error("runtime:local-rpc:session-file-missing");
  }
  return file;
}

/** spawn 上下文：由 backend.open() 解析好的绝对路径（单测可注入假路径纯测派生） */
export type SpawnContext = {
  agentDir: string;
  sessionDir: string;
  sessionFile: string;
};

/** 纯派生：RuntimeSpec + spawn 上下文 → RpcClientOptions（无 IO，单测友好） */
export function buildRpcClientOptions(
  spec: RuntimeSpec,
  context: SpawnContext,
  options: LocalRpcBackendOptions = {}
): RpcClientOptions {
  // 与 InProcessBackend 同派生：无 workspace 即关执行类工具；cwd 供 bash 等用
  const args = [
    "--session",
    context.sessionFile,
    "--system-prompt",
    spec.systemPrompt,
    // --append-system-prompt 可重复，逐段展开（skills 段 + 执行段）
    ...spec.appendSystemPrompt.flatMap((segment) => [
      "--append-system-prompt",
      segment,
    ]),
    ...(spec.workspaceDir ? [] : ["--no-builtin-tools"]),
    ...(options.extensions ?? []).flatMap((extensionPath) => [
      "--extension",
      extensionPath,
    ]),
  ];
  return {
    args,
    cliPath: options.cliPath ?? resolveDefaultCliPath(),
    cwd: spec.workspaceDir ?? MANAGED_AGENT_DIR,
    // PI_OFFLINE 先于 options.env：默认阻止 loader 网络安装适配器，调用方可覆盖
    env: {
      PI_CODING_AGENT_DIR: context.agentDir,
      PI_OFFLINE: "1",
      ...(options.env ?? {}),
    },
    model: spec.model.id,
    provider: spec.model.provider,
  };
}
