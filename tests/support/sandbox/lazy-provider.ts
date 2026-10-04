import type {
  SandboxHandle,
  SandboxProvider,
  SandboxReleasePolicy,
  SandboxSpec,
} from "../../../lib/runtime/sandbox";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
}

/** In-memory ownership probe only; never launches a real process. */
export function makeLazySandboxFixture() {
  const calls = {
    acquire: 0,
    attach: 0,
    process: 0,
    releases: [] as SandboxReleasePolicy[],
  };
  const handle: SandboxHandle = {
    destroy: async () => undefined,
    id: "lazy-fixture",
    readFile: async () => new Uint8Array([1]),
    renew: async () => undefined,
    startProcess: () => {
      calls.process += 1;
      return Promise.reject(new Error("fixture process unavailable"));
    },
    status: async () => "ready",
    workspaceRoot: "/workspace",
    writeFile: async () => undefined,
  };
  const provider: SandboxProvider = {
    acquire: () => {
      calls.acquire += 1;
      return Promise.resolve(handle);
    },
    attach: () => {
      calls.attach += 1;
      return Promise.resolve(handle);
    },
    name: "test",
    release: (_handle, policy) => {
      calls.releases.push(policy);
      return Promise.resolve();
    },
  };
  const spec: SandboxSpec = {
    chatId: "chat-fixture",
    egress: { mode: "deny-all" },
    image: "test:fixture",
    resource: { cpuCores: 1, memoryMB: 512 },
    runId: "run-fixture",
    ttlSeconds: 60,
    workspaceVolume: { source: "/unused" },
  };
  return { calls, handle, provider, spec };
}
