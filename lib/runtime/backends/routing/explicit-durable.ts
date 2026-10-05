import type { RuntimeBackend, RuntimeSpec } from "../../protocol";

/** Server-selected per-run lane, never an error fallback or an in-flight migration. */
export class ExplicitDurableRuntimeBackend implements RuntimeBackend {
  private readonly normal: RuntimeBackend;
  private readonly durable?: RuntimeBackend;

  constructor(normal: RuntimeBackend, durable?: RuntimeBackend) {
    this.normal = normal;
    this.durable = durable;
  }

  open(spec: RuntimeSpec) {
    if (spec.lane === "durable_sandbox") {
      if (!this.durable) {
        return Promise.reject(
          new Error("runtime:durable-chat:lane-not-enabled")
        );
      }
      return this.durable.open(spec);
    }
    return this.normal.open(spec);
  }
}
