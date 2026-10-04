import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionExecutionState,
  type ExecutionState,
} from "../../../../lib/runtime/protocol/execution-state";

const states: ExecutionState[] = [
  "queued",
  "waiting_capacity",
  "starting",
  "running",
  "waiting_user",
  "needs_review",
  "settled",
  "failed",
  "aborted",
];

test("execution state: preserve lifecycle and bounded capacity waiting", () => {
  assert.ok(canTransitionExecutionState("queued", "waiting_capacity"));
  assert.ok(canTransitionExecutionState("waiting_capacity", "starting"));
  assert.ok(canTransitionExecutionState("starting", "running"));
  assert.ok(canTransitionExecutionState("running", "waiting_user"));
  assert.ok(canTransitionExecutionState("waiting_user", "running"));
  assert.equal(canTransitionExecutionState("queued", "settled"), false);
});

test("execution state: terminal results cannot be restarted or overwritten", () => {
  for (const from of ["settled", "failed", "aborted"] as const) {
    for (const to of states) {
      assert.equal(
        canTransitionExecutionState(from, to, {
          processesStopped: true,
          reconciled: true,
        }),
        false
      );
    }
  }
});

test("execution state: cannot finalize active work without verified process stop", () => {
  for (const from of ["starting", "running", "waiting_user"] as const) {
    for (const to of ["failed", "aborted"] as const) {
      assert.equal(canTransitionExecutionState(from, to), false);
      assert.ok(
        canTransitionExecutionState(from, to, { processesStopped: true })
      );
    }
    assert.ok(canTransitionExecutionState(from, "needs_review"));
  }
  assert.equal(canTransitionExecutionState("running", "settled"), false);
  assert.ok(
    canTransitionExecutionState("running", "settled", {
      processesStopped: true,
    })
  );
});

test("execution state: unknown outcomes require review, never automatic resubmission", () => {
  for (const to of [
    "queued",
    "starting",
    "running",
    "waiting_capacity",
  ] as const) {
    assert.equal(
      canTransitionExecutionState("needs_review", to, {
        processesStopped: true,
        reconciled: true,
      }),
      false
    );
  }
  for (const to of ["settled", "failed", "aborted"] as const) {
    assert.equal(canTransitionExecutionState("needs_review", to), false);
    assert.equal(
      canTransitionExecutionState("needs_review", to, {
        processesStopped: true,
      }),
      false
    );
    assert.equal(
      canTransitionExecutionState("needs_review", to, { reconciled: true }),
      false
    );
    assert.ok(
      canTransitionExecutionState("needs_review", to, {
        processesStopped: true,
        reconciled: true,
      })
    );
  }
});

test("execution state: unstarted queue entries can be cancelled or rejected", () => {
  assert.ok(canTransitionExecutionState("queued", "aborted"));
  assert.ok(canTransitionExecutionState("waiting_capacity", "failed"));
  assert.equal(
    canTransitionExecutionState("waiting_capacity", "settled"),
    false
  );
});
