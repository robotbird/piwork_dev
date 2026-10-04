import assert from "node:assert/strict";
import test from "node:test";
import { SandboxUnavailableError } from "../../../../lib/runtime/sandbox";
import {
  decideSandboxFailure,
  SandboxOperationError,
  sandboxCleanupFailure,
} from "../../../../lib/runtime/sandbox/operation-error";

test("operation: only explicitly unstarted transient work allows one retry", () => {
  const error = new SandboxOperationError("not submitted", {
    phase: "not_started",
    transient: true,
  });
  assert.equal(decideSandboxFailure(error, 0), "retry_once");
  for (const retries of [1, 2, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(decideSandboxFailure(error, retries), "fail");
  }
});

test("operation: ordinary transport/acquisition errors provide no unstarted proof", () => {
  for (const error of [
    new Error("broken pipe"),
    new SandboxUnavailableError("timeout"),
    "not_started",
    { phase: "not_started", transient: true },
    null,
  ]) {
    assert.equal(decideSandboxFailure(error, 0), "needs_review");
  }
});

test("operation: started/unknown must not replay even if transient", () => {
  for (const phase of ["started", "outcome_unknown"] as const) {
    const error = new SandboxOperationError("connection lost", {
      phase,
      transient: true,
    });
    assert.equal(decideSandboxFailure(error, 0), "needs_review");
  }
});

test("operation: permanent unstarted or completed errors must not replay", () => {
  assert.equal(
    decideSandboxFailure(
      new SandboxOperationError("denied", { phase: "not_started" }),
      0
    ),
    "fail"
  );
  assert.equal(
    decideSandboxFailure(
      new SandboxOperationError("result rejected", {
        phase: "completed",
        transient: true,
      }),
      0
    ),
    "fail"
  );
});

test("operation: cleanup failure preserves both causes and requires review", () => {
  const execution = new Error("lost result");
  const cleanup = new Error("kill denied");
  const error = sandboxCleanupFailure(
    "needs reconciliation",
    execution,
    cleanup
  );
  assert.equal(decideSandboxFailure(error, 0), "needs_review");
  assert.ok(error.cause instanceof AggregateError);
  assert.deepEqual(error.cause.errors, [execution, cleanup]);
});

test("operation: preserve provider evidence/cause for audit", () => {
  const cause = new Error("upstream failure");
  const error = new SandboxOperationError("failed", {
    cause,
    phase: "outcome_unknown",
  });
  assert.equal(error.name, "SandboxOperationError");
  assert.equal(error.cause, cause);
  assert.equal(error.phase, "outcome_unknown");
  assert.equal(error.transient, false);
});
