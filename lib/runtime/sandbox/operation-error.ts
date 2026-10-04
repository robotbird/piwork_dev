/** Provider-owned evidence about execution, NOT inferred from transport errors.
 * A broken pipe/timeout alone must be outcome_unknown. These classifications
 * do not claim process-tree termination or business exactly-once semantics.
 */
export type SandboxOperationPhase =
  | "not_started"
  | "started"
  | "completed"
  | "outcome_unknown";

export class SandboxOperationError extends Error {
  readonly phase: SandboxOperationPhase;
  readonly transient: boolean;

  constructor(
    message: string,
    options: {
      phase: SandboxOperationPhase;
      transient?: boolean;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = "SandboxOperationError";
    this.phase = options.phase;
    this.transient = options.transient ?? false;
  }
}

/** Preserve both failures while keeping an explicit review-required phase. */
export function sandboxCleanupFailure(
  message: string,
  operationError: unknown,
  cleanupError: unknown
): SandboxOperationError {
  return new SandboxOperationError(message, {
    cause: new AggregateError([operationError, cleanupError], message, {
      cause: cleanupError,
    }),
    phase: "outcome_unknown",
  });
}

/** Advisory result for the future operation journal/dispatcher. No retries are
 * performed here. Ordinary errors, even SandboxUnavailableError, carry no proof
 * that a provision/command didn't run. Only explicit not_started is retryable.
 */
export function decideSandboxFailure(
  error: unknown,
  retriesUsed: number
): "retry_once" | "fail" | "needs_review" {
  if (!(error instanceof SandboxOperationError)) {
    return "needs_review";
  }
  if (error.phase === "started" || error.phase === "outcome_unknown") {
    return "needs_review";
  }
  if (error.phase === "not_started" && error.transient && retriesUsed === 0) {
    return "retry_once";
  }
  return "fail";
}
