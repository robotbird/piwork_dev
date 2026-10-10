import "server-only";
import { getSandboxResourcePolicy } from "../db/sandbox-settings-queries";

/** Public deployment metadata only; never expose endpoints, keys or host paths. */
export async function getSandboxSettingsView() {
  const resource = await getSandboxResourcePolicy();
  const provider = process.env.PIWORK_SANDBOX_PROVIDER;
  return {
    inferenceConfigured: Boolean(process.env.PIWORK_INFERENCE_URL),
    provider:
      provider === "docker" || provider === "opensandbox" ? provider : null,
    resource,
    routing: process.env.PIWORK_SANDBOX_ROUTING === "all" ? "all" : "matrix",
  };
}
export type SandboxSettingsView = Awaited<
  ReturnType<typeof getSandboxSettingsView>
>;
