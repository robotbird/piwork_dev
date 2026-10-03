import "server-only";
import {
  getSandboxInstance,
  listSandboxInstances,
  observeSandboxInstance,
} from "@/lib/db/sandbox-queries";
import { buildSandboxProvider } from "@/lib/runtime/sandbox/configuration";
import { SandboxManagementService } from "./sandbox-service";

const management = new SandboxManagementService({
  control: (provider) =>
    provider === "test" ? undefined : buildSandboxProvider(provider).control,
  get: getSandboxInstance,
  list: () => listSandboxInstances({ reconcileExpiry: false }),
  observe: observeSandboxInstance,
  stopRun: async (chatId, runId) => {
    if (!runId) {
      return;
    }
    const { getRunManager } = await import("@/lib/runtime/run");
    // Send Pi's official abort through RunManager; kill still ends an unresponsive process.
    await getRunManager()
      .abortByChat(chatId, runId)
      .catch(() => undefined);
  },
});

export function getSandboxManagement() {
  return management;
}
