/** Future job execution state, not RuntimeSnapshot.status or a DB migration.
 * Kept separate until all AgentRun/UI/scheduler consumers can handle new states.
 * A DB caller must also CAS the expected owner/attempt/fencing token; this pure
 * transition check alone does not stop a process or establish ownership.
 */
export type ExecutionState =
  | "queued"
  | "waiting_capacity"
  | "starting"
  | "running"
  | "waiting_user"
  | "needs_review"
  | "settled"
  | "failed"
  | "aborted";

const transitions: Record<ExecutionState, readonly ExecutionState[]> = {
  aborted: [],
  failed: [],
  needs_review: ["settled", "failed", "aborted"],
  queued: ["waiting_capacity", "starting", "failed", "aborted"],
  running: ["waiting_user", "needs_review", "settled", "failed", "aborted"],
  settled: [],
  starting: ["running", "needs_review", "failed", "aborted"],
  waiting_capacity: ["queued", "starting", "failed", "aborted"],
  waiting_user: ["running", "needs_review", "failed", "aborted"],
};

export function canTransitionExecutionState(
  from: ExecutionState,
  to: ExecutionState,
  evidence: {
    /** Provider verified no process can still mutate the workspace. */
    processesStopped?: boolean;
    /** Trusted review found the side effects/result of an unknown operation. */
    reconciled?: boolean;
  } = {}
): boolean {
  if (!transitions[from]?.includes(to)) {
    return false;
  }
  if (from === "needs_review") {
    return evidence.reconciled === true && evidence.processesStopped === true;
  }
  if (
    ["starting", "running", "waiting_user"].includes(from) &&
    ["settled", "failed", "aborted"].includes(to)
  ) {
    return evidence.processesStopped === true;
  }
  return true;
}
