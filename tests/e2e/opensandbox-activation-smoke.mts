// Explicit single-sandbox live smoke. Uses platform provider/official SDK, not a replacement client.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { getSandboxResourcePolicy } from "../../lib/db/sandbox-settings-queries";
import type { SandboxHandle } from "../../lib/runtime/sandbox";
import { buildSandboxProvider } from "../../lib/runtime/sandbox/configuration";

if (process.env.PIWORK_OPENSANDBOX_ACTIVATION_TEST !== "1") {
  console.log(
    "Skipped: set PIWORK_OPENSANDBOX_ACTIVATION_TEST=1 for a real provider probe."
  );
  process.exit(0);
}
assert.equal(process.env.PIWORK_SANDBOX_PROVIDER, "opensandbox");
const image = process.env.PIWORK_SANDBOX_IMAGE;
const proxy = process.env.PIWORK_INFERENCE_URL;
assert(image && proxy);
const provider = buildSandboxProvider("opensandbox");
const resource = await getSandboxResourcePolicy();
let handle: SandboxHandle | undefined;
async function execute(script: string) {
  assert(handle);
  const channel = await handle.startProcess({
    argv: ["node", "-e", script],
    cwd: handle.workspaceRoot,
  });
  try {
    let output = "";
    const result = await Promise.race([
      (async () => {
        for await (const bytes of channel.read()) {
          output += Buffer.from(bytes).toString();
        }
        return channel.onExit;
      })(),
      new Promise<never>((_resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Probe command timed out")),
          20_000
        );
        timer.unref();
      }),
    ]);
    assert.equal(result.code, 0);
    return output.trim();
  } finally {
    await channel.close();
  }
}
try {
  handle = await provider.acquire({
    chatId: crypto.randomUUID(),
    egress: { fqdns: [new URL(proxy).hostname], mode: "allowlist" },
    image,
    metadata: { "piwork.activation-probe": "single-functional-smoke" },
    resource,
    runId: crypto.randomUUID(),
    ttlSeconds: 600,
    workspaceVolume: { source: "ephemeral" },
  });
  console.log("Created sandbox:", handle.id, "resource:", resource);
  assert.equal(await handle.status(), "ready");
  const hostConfig = JSON.parse(
    execFileSync(
      "docker",
      ["inspect", `sandbox-${handle.id}`, "--format", "{{json .HostConfig}}"],
      { encoding: "utf8" }
    )
  );
  const cpuLimit =
    hostConfig.NanoCpus > 0
      ? hostConfig.NanoCpus / 1e9
      : hostConfig.CpuQuota / hostConfig.CpuPeriod;
  assert.equal(cpuLimit, resource.cpuCores);
  assert.equal(hostConfig.Memory, resource.memoryMB * 1024 * 1024);
  const sidecar = JSON.parse(
    execFileSync(
      "docker",
      [
        "inspect",
        `sandbox-egress-${handle.id}`,
        "--format",
        "{{json .HostConfig.PortBindings}}",
      ],
      { encoding: "utf8" }
    )
  ) as Record<string, { HostIp: string }[]>;
  const bindings = Object.values(sidecar).flat();
  assert(bindings.length > 0);
  assert(
    bindings.every((binding) => binding.HostIp === "127.0.0.1"),
    "Every sandbox port must remain loopback-only"
  );
  console.log(
    "PASS: Docker enforced CPU/memory and loopback-only port bindings"
  );
  console.log("Isolation audit (not enterprise acceptance):", {
    capDrop: hostConfig.CapDrop,
    privileged: hostConfig.Privileged,
    readonlyRootfs: hostConfig.ReadonlyRootfs,
    securityOpt: hostConfig.SecurityOpt,
  });
  await handle.writeFile(
    `${handle.workspaceRoot}/smoke/hello.txt`,
    Buffer.from("OpenSandbox 中文文件验证")
  );
  assert.equal(
    Buffer.from(
      await handle.readFile(`${handle.workspaceRoot}/smoke/hello.txt`)
    ).toString(),
    "OpenSandbox 中文文件验证"
  );
  const version = await execute(
    "console.log(require('/opt/pi/node_modules/@earendil-works/pi-coding-agent/package.json').version)"
  );
  assert.equal(version, "1.1.0");
  const status = await execute(
    `fetch(${JSON.stringify(`${proxy}/messages`)},{method:'POST',signal:AbortSignal.timeout(5000)}).then(r=>console.log(r.status)).catch(e=>{console.error(e.message);process.exitCode=1})`
  );
  assert.equal(status, "401");
  const identity = await execute(
    "const fs=require('node:fs');const s=fs.readFileSync('/proc/self/status','utf8');console.log(JSON.stringify({uid:process.getuid(),gid:process.getgid(),noNewPrivs:s.match(/^NoNewPrivs:\\s*(\\d+)/m)?.[1],capEff:s.match(/^CapEff:\\s*(\\w+)/m)?.[1]}))"
  );
  console.log("Actual execd process identity (not image USER):", identity);
  await handle.renew();
  console.log(
    "PASS: ready, bounded resources, file read/write, PTY command, Pi 1.1.0, proxy HTTP 401 and renew"
  );
} finally {
  if (handle) {
    await provider.release(handle, "kill");
    assert.equal(await provider.control?.inspect(handle.id), null);
    console.log("PASS: provider confirmed sandbox deleted");
  }
}
