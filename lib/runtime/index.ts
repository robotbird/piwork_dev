import { InProcessBackend } from "./backends/in-process/backend";
import type { RuntimeBackend } from "./protocol";

export type { RuntimeSession } from "./protocol";

let backend: RuntimeBackend | undefined;

/**
 * Step 1 恒返回 InProcessBackend；Step 8 迁移生产默认路径后按部署形态
 * 选择 Sandbox RPC backend（fail-closed：不可信代码不回退 in-process）。
 */
export function getRuntimeBackend(): RuntimeBackend {
  backend ??= new InProcessBackend();
  return backend;
}
