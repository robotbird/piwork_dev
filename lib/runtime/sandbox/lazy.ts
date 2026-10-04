import type { SandboxHandle, SandboxProvider, SandboxSpec } from "./index";

/** Resource ownership only; does not execute, rebuild or retry tools.
 * First ensure provisions once; failed acquisition remains failed for this run.
 * A new run/reconciled operation must explicitly construct a new owner.
 * Kill-only until reaper/idle capacity and persistent workspace are verified.
 * close waits for late acquisition and reports release failure to its caller.
 */
export class LazySandbox {
  private readonly provider: SandboxProvider;
  private readonly spec: SandboxSpec;
  private readonly signal: AbortSignal | undefined;
  private acquisition: Promise<SandboxHandle> | undefined;
  private closing: Promise<void> | undefined;
  private closed = false;

  constructor(
    provider: SandboxProvider,
    spec: SandboxSpec,
    options: { signal?: AbortSignal } = {}
  ) {
    this.provider = provider;
    this.spec = structuredClone(spec);
    this.signal = options.signal;
    if (this.signal?.aborted) {
      this.closed = true;
    } else {
      this.signal?.addEventListener("abort", this.onAbort, { once: true });
    }
  }

  async ensure(): Promise<SandboxHandle> {
    this.assertOpen();
    // Defer acquire so synchronous cancellation/close can prevent provision.
    this.acquisition ??= Promise.resolve().then(() => {
      this.assertOpen();
      return this.provider.acquire(this.spec);
    });
    const handle = await this.acquisition;
    // Never hand a late resource to a cancelled/closed run. close owns release.
    this.assertOpen();
    return handle;
  }

  close(): Promise<void> {
    if (this.closing) {
      return this.closing;
    }
    this.closed = true;
    this.signal?.removeEventListener("abort", this.onAbort);
    this.closing = this.releaseAcquisition();
    return this.closing;
  }

  private readonly onAbort = (): void => {
    // Observe rejection to avoid an unhandled promise from an event handler;
    // close() retains the same rejected promise for lifecycle/audit reporting.
    this.close().catch(() => undefined);
  };

  private assertOpen(): void {
    this.signal?.throwIfAborted();
    if (this.closed) {
      throw new Error("runtime:sandbox:closed");
    }
  }

  private async releaseAcquisition(): Promise<void> {
    if (!this.acquisition) {
      return;
    }
    let handle: SandboxHandle;
    try {
      handle = await this.acquisition;
    } catch {
      // No handle was returned. acquire must clean its own partial provision;
      // orphan scanning is still needed for process death/provider ambiguity.
      return;
    }
    await this.provider.release(handle, "kill");
  }
}
