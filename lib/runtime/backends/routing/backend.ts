import "server-only";

import type {
  RuntimeBackend,
  RuntimeSession,
  RuntimeSpec,
} from "../../protocol";

/**
 * RoutingRuntimeBackend（v2.0 §8.1 路由矩阵，spec §6 Phase 5 MVP）：按
 * RuntimeSpec 内容逐 run 在 InProcess 与 SandboxRpc 之间选择——并存非降级。
 *
 * 判定（requiresSandbox）：执行类工具开启（workspaceDir 非 null）即存在
 * 非平台代码执行载体（bash 等在 workspace 内执行任意命令）→ Sandbox；
 * 纯对话（无执行工具）→ 允许 in-process。矩阵与 AgentRun.backend 落库
 * 走同一 requiresSandbox（装配处经 backendKindFor 传入 RunManager）。
 *
 * 能力边界（如实声明，后续完善）：
 * - 平台闭包工具（spec.tools：技能工具、create_scheduled_task）不跨进程，
 *   Sandbox 路由的 run 会丢失它们（LocalRpc/SandboxRpc 既有边界，v2.0
 *   Step 4 bridge 方案解锁）；
 * - Package/MCP 尚未进入 RuntimeSpec，仍走 in-process（Sandbox 侧能力
 *   未达；灰度搬运属后续阶段）。
 *
 * fail-closed（spec §7.3）：选中 Sandbox 后 open 失败原样上抛（run
 * failed），绝不回落 in-process 执行非平台代码。
 */

export function requiresSandbox(spec: RuntimeSpec): boolean {
  return spec.workspaceDir !== null;
}

export type RoutingRuntimeBackendOptions = {
  inProcess: RuntimeBackend;
  sandbox: RuntimeBackend;
};

export class RoutingRuntimeBackend implements RuntimeBackend {
  private readonly options: RoutingRuntimeBackendOptions;

  constructor(options: RoutingRuntimeBackendOptions) {
    this.options = options;
  }

  open(spec: RuntimeSpec): Promise<RuntimeSession> {
    return requiresSandbox(spec)
      ? this.options.sandbox.open(spec)
      : this.options.inProcess.open(spec);
  }
}
