import "server-only";

import { postgresAgentRunStore } from "@/lib/db/agent-run-queries";
import { registerGeneratedFile } from "@/lib/db/library-queries";
import { upsertMessage } from "@/lib/db/queries";
import { PostgresEventStore } from "@/lib/db/runtime-event-queries";
import { InProcessBackend } from "../backends/in-process/backend";
import { RunManager } from "./run-manager";

/**
 * RunManager 组装与单例（v2.0 §8.2）：InProcessBackend + Postgres 持久化。
 * 挂 globalThis Symbol 键使 dev HMR 下 run 状态存活；进程全量重启则
 * LiveRun 丢失，由 attach 落空 → failZombieRuns 兜底（§2.12）。
 */

type RunManagerGlobal = {
  manager?: RunManager;
  /** 进程实例 id：lease 持有者标识（重启即更换） */
  workerId?: string;
};

const RUN_MANAGER_KEY = Symbol.for("piwork.run-manager");
const globalScope = globalThis as Record<symbol, RunManagerGlobal | undefined>;
globalScope[RUN_MANAGER_KEY] ??= {};
const runtimeGlobal = globalScope[RUN_MANAGER_KEY];

runtimeGlobal.workerId ??= globalThis.crypto.randomUUID();
runtimeGlobal.manager ??= new RunManager({
  backend: new InProcessBackend(registerGeneratedFile),
  eventStore: new PostgresEventStore(),
  messageStore: {
    upsertAssistantMessage: async ({ chatId, id, parts }) => {
      await upsertMessage({ chatId, id, parts });
    },
  },
  runStore: postgresAgentRunStore,
  workerId: runtimeGlobal.workerId,
});

export function getRunManager(): RunManager {
  const { manager } = runtimeGlobal;
  if (!manager) {
    throw new Error("runtime:run-manager:not-initialized");
  }
  return manager;
}
