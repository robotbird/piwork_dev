import { DockerSandboxProvider } from "./docker/provider";
import type { SandboxProvider } from "./index";
import { OpenSandboxProvider } from "./opensandbox/provider";

/**
 * OPENSANDBOX_* 走环境注入（部署时由平台密钥存储落 env，不进 RuntimeSpec
 * 明文，spec §6 Phase 3）；缺任一必配即抛错（fail-closed）。
 */
export function buildSandboxProvider(
  providerName: "docker" | "opensandbox"
): SandboxProvider {
  if (providerName === "docker") {
    return new DockerSandboxProvider();
  }
  const domain = process.env.OPENSANDBOX_DOMAIN;
  if (!domain) {
    throw new Error(
      "runtime:sandbox:missing-config:OPENSANDBOX_DOMAIN（lifecycle server 地址，fail-closed）"
    );
  }
  const apiKey = process.env.OPENSANDBOX_API_KEY;
  if (!apiKey) {
    throw new Error(
      "runtime:sandbox:missing-config:OPENSANDBOX_API_KEY（走平台密钥存储，fail-closed）"
    );
  }
  const protocolRaw = process.env.OPENSANDBOX_PROTOCOL;
  if (
    protocolRaw !== undefined &&
    protocolRaw !== "http" &&
    protocolRaw !== "https"
  ) {
    throw new Error(
      "runtime:sandbox:bad-config:OPENSANDBOX_PROTOCOL（仅 http|https）"
    );
  }
  const readyTimeoutSeconds = parseOptionalInt(
    "OPENSANDBOX_READY_TIMEOUT_SECONDS"
  );
  const execdPort = parseOptionalInt("OPENSANDBOX_EXECD_PORT");
  return new OpenSandboxProvider({
    apiKey,
    domain,
    ...(protocolRaw === undefined ? {} : { protocol: protocolRaw }),
    ...(readyTimeoutSeconds === undefined ? {} : { readyTimeoutSeconds }),
    ...(execdPort === undefined ? {} : { execdPort }),
  });
}

export function parseOptionalInt(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) {
    return;
  }
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(`runtime:sandbox:bad-config:${name}`);
  }
  return value;
}
