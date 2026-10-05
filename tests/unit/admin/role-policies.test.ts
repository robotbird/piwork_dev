import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveRoleModelAccess,
  roleModelPolicySchema,
} from "../../../lib/admin/role-model-policy";
import {
  roleTokenPolicySchema,
  tokenLimitExceeded,
} from "../../../lib/admin/role-token-policy";

test("model policies validate default, duplicates, empty deny-all and switches", () => {
  assert.equal(
    roleModelPolicySchema.safeParse({
      allowSwitch: true,
      defaultModelId: "p/b",
      enabledModelIds: ["p/a"],
    }).success,
    false
  );
  assert.equal(
    roleModelPolicySchema.safeParse({
      allowSwitch: true,
      defaultModelId: "p/a",
      enabledModelIds: ["p/a", "p/a"],
    }).success,
    false
  );
  assert.equal(
    roleModelPolicySchema.safeParse({
      allowSwitch: true,
      defaultModelId: null,
      enabledModelIds: ["p/a"],
    }).success,
    false
  );
  assert.equal(
    roleModelPolicySchema.safeParse({
      allowSwitch: false,
      defaultModelId: null,
      enabledModelIds: [],
    }).success,
    true
  );
});
test("configured roles union grants, locked roles grant only default, unavailable models fail closed", () => {
  const access = resolveRoleModelAccess(
    [
      {
        allowSwitch: false,
        defaultModelId: "p/a",
        enabledModelIds: ["p/a", "p/b"],
      },
      {
        allowSwitch: true,
        defaultModelId: "q/a",
        enabledModelIds: ["q/a", "gone/a"],
      },
    ],
    ["p/a", "p/b", "q/a"],
    "p/b"
  );
  assert.deepEqual(access.modelIds, ["p/a", "q/a"]);
  assert.equal(access.defaultModelId, "p/a");
  assert.equal(access.allowSwitch, true);
  assert.deepEqual(
    resolveRoleModelAccess(
      [
        {
          allowSwitch: false,
          defaultModelId: "gone/a",
          enabledModelIds: ["gone/a"],
        },
      ],
      ["p/a"],
      "p/a"
    ).modelIds,
    []
  );
  assert.deepEqual(resolveRoleModelAccess([], ["p/a"], "p/a").modelIds, [
    "p/a",
  ]);
  assert.deepEqual(
    resolveRoleModelAccess(
      [{ allowSwitch: true, defaultModelId: null, enabledModelIds: [] }],
      ["p/a"],
      "p/a"
    ).modelIds,
    []
  );
});
test("quota validates positive integer nullable limits and checks exact thresholds", () => {
  for (const value of [
    0,
    -1,
    1.1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1_000_000_000_001,
  ]) {
    assert.equal(
      roleTokenPolicySchema.safeParse({
        action: "block",
        daily: null,
        monthly: value,
        perRun: null,
      }).success,
      false
    );
  }
  const policy = roleTokenPolicySchema.parse({
    action: "block",
    daily: 100,
    monthly: 1000,
    perRun: 50,
  });
  assert.equal(
    tokenLimitExceeded(policy, { daily: 99, monthly: 999, perRun: 49 }),
    false
  );
  assert.equal(tokenLimitExceeded(policy, { daily: 100, monthly: 0 }), true);
  assert.equal(tokenLimitExceeded(policy, { daily: 0, monthly: 1000 }), true);
  assert.equal(
    tokenLimitExceeded(policy, { daily: 0, monthly: 0, perRun: 50 }),
    true
  );
  assert.equal(
    tokenLimitExceeded(
      { action: "warn", daily: null, monthly: null, perRun: null },
      { daily: 999, monthly: 999, perRun: 999 }
    ),
    false
  );
});
