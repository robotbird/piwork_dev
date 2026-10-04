import type { RunDescriptor } from "../../../lib/runtime/protocol/run-descriptor";

export const descriptorHash = "a".repeat(64);

export function makeRunDescriptor(): RunDescriptor {
  return {
    attachments: [],
    attempt: 1,
    backend: "in_process",
    budget: {
      maxCostMicros: 1_000_000,
      maxModelRetries: 2,
      maxRunSeconds: 300,
      maxTokens: 100_000,
      maxToolSeconds: 120,
    },
    chatId: "00000000-0000-4000-8000-000000000001",
    egress: { mode: "deny-all" },
    history: {
      id: "00000000-0000-4000-8000-000000000002",
      revision: 1,
      sha256: descriptorHash,
    },
    input: {
      id: "00000000-0000-4000-8000-000000000003",
      revision: 1,
      sha256: descriptorHash,
    },
    lane: "interactive",
    model: { modelId: "chat-model", providerId: "faux" },
    packages: [],
    policyVersion: "policy-v1",
    prompt: { id: "office", sha256: descriptorHash, version: "1" },
    runId: "00000000-0000-4000-8000-000000000004",
    schemaVersion: 1,
    skills: [],
    tools: [],
    userId: "00000000-0000-4000-8000-000000000005",
    workspace: null,
  };
}

export function makeWorkspaceDescriptor(): RunDescriptor {
  return {
    ...makeRunDescriptor(),
    backend: "sandbox_tools",
    tools: [
      { effect: "workspace", id: "bash", sha256: descriptorHash, version: "1" },
    ],
    workspace: {
      id: "00000000-0000-4000-8000-000000000006",
      image: `office@sha256:${descriptorHash}`,
      resource: {
        cpuCores: 2,
        diskBytes: 2_000_000_000,
        maxFiles: 20_000,
        memoryMB: 2048,
        pids: 128,
      },
    },
  };
}
