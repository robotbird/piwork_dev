import "../../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RUN_TOKEN_TTL_MS,
  RunTokenRegistry,
} from "@/lib/runtime/inference-proxy/tokens";

/**
 * RunTokenRegistry 专测（spec §6 Phase 4，v2.0 §7.2）：按 run 签发、
 * sha256 存储、滑动续期、主动撤销、失败不区分原因（防侧信道）。
 */

const GRANT = {
  chatId: "00000000-0000-0000-0000-0000000000aa",
  grants: [{ model: "deepseek-flash", provider: "deepseek" }],
  runId: "run-1",
};

test("mint → validate 往返：返回授权信息，token 为 64 位 hex", () => {
  const tokens = new RunTokenRegistry();
  const { token, grant } = tokens.mint(GRANT);
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.deepEqual(grant, GRANT);
  assert.deepEqual(tokens.validate(token), GRANT);
  assert.equal(tokens.size, 1);
});

test("空授权拒绝签发（run 未授权任何模型）", () => {
  const tokens = new RunTokenRegistry();
  assert.throws(
    () => tokens.mint({ ...GRANT, grants: [] }),
    /inference-proxy:token:no-grants/
  );
});

test("未知 / 篡改 token 一律 null，不区分原因", () => {
  const tokens = new RunTokenRegistry();
  const { token } = tokens.mint(GRANT);
  assert.equal(tokens.validate("deadbeef"), null);
  assert.equal(tokens.validate(`${token.slice(0, -1)}0`), null);
  // 长度正确的随机串同样 null
  assert.equal(tokens.validate("0".repeat(64)), null);
});

test("TTL 到期失效；validate 滑动续期", () => {
  let now = 1_000_000;
  const tokens = new RunTokenRegistry({ defaultTtlMs: 1000, now: () => now });
  const { token } = tokens.mint(GRANT);
  now += 999;
  assert.ok(tokens.validate(token), "到期前一刻仍有效（滑动续期至 now+1000）");
  now += 500; // 距上次校验 500ms < 续期后的 1000ms
  assert.ok(tokens.validate(token), "续期窗口内再次校验仍有效");
  now += 1001; // 越过最新到期时刻
  assert.equal(tokens.validate(token), null, "闲置超过 TTL 后失效");
  assert.equal(tokens.size, 1, "过期条目仍在表内（惰性失效，规模监控可见）");
});

test("revokeRun：撤销该 run 全部 token、幂等、不波及其他 run", () => {
  const tokens = new RunTokenRegistry();
  const a1 = tokens.mint({ ...GRANT, runId: "run-a" });
  const a2 = tokens.mint({ ...GRANT, runId: "run-a" });
  const b = tokens.mint({ ...GRANT, runId: "run-b" });
  tokens.revokeRun("run-a");
  tokens.revokeRun("run-a"); // 幂等
  assert.equal(tokens.validate(a1.token), null);
  assert.equal(tokens.validate(a2.token), null);
  assert.ok(tokens.validate(b.token), "其他 run 不受影响");
  // 撤销后重放同一 token 无效（表项已删）
  tokens.revokeRun("run-b");
  assert.equal(tokens.validate(b.token), null);
  assert.equal(tokens.size, 0);
});

test("mint 的 token 两两不同（随机 32B）", () => {
  const tokens = new RunTokenRegistry({ tokenBytes: 8 });
  const seen = new Set<string>();
  for (let i = 0; i < 64; i += 1) {
    seen.add(tokens.mint(GRANT).token);
  }
  assert.equal(seen.size, 64);
});

test("默认 TTL 为 30 分钟", () => {
  assert.equal(DEFAULT_RUN_TOKEN_TTL_MS, 30 * 60_000);
});
