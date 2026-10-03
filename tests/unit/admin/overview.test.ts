import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateProviderHealth,
  computeChangePct,
} from "../../../lib/admin/overview";

test("computeChangePct rounds to one decimal and yields null without baseline", () => {
  assert.equal(computeChangePct(110, 100), 10);
  assert.equal(computeChangePct(90, 100), -10);
  assert.equal(computeChangePct(101, 90), 12.2);
  assert.equal(computeChangePct(5, 0), null);
  assert.equal(computeChangePct(0, 0), null);
});

test("aggregateProviderHealth follows worst-case status of enabled plugins", () => {
  const none = { degraded: 0, enabled: 0, failed: 0, healthy: 0 };
  const allHealthy = { degraded: 0, enabled: 2, failed: 0, healthy: 2 };
  const degraded = { degraded: 1, enabled: 2, failed: 0, healthy: 1 };
  const failed = { degraded: 0, enabled: 2, failed: 1, healthy: 1 };
  const unknown = { degraded: 0, enabled: 1, failed: 0, healthy: 0 };

  assert.equal(aggregateProviderHealth(none), "unknown");
  assert.equal(aggregateProviderHealth(allHealthy), "operational");
  assert.equal(aggregateProviderHealth(degraded), "degraded");
  assert.equal(aggregateProviderHealth(failed), "error");
  assert.equal(aggregateProviderHealth(unknown), "unknown");
});
