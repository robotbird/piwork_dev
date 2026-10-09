import assert from "node:assert/strict";
import test from "node:test";
import {
  generateShareToken,
  hashShareToken,
  projectUserAvatar,
  SHARE_INVITE_TTL_DAYS,
  sameShareTokenHash,
} from "@/lib/db/chat-share-queries";

test("avatar projection only accepts platform library preview urls", () => {
  const itemId = "123e4567-e89b-42d3-a456-426614174000";

  assert.equal(
    projectUserAvatar(`/api/library/${itemId}?preview=1`, "u1"),
    "/api/users/u1/avatar"
  );
  assert.equal(
    projectUserAvatar(`/api/library/${itemId}`, "u2"),
    "/api/users/u2/avatar"
  );
  // 未设置 / 外部 URL / 非平台路径 → null（不代理任意地址）
  assert.equal(projectUserAvatar(null, "u1"), null);
  assert.equal(projectUserAvatar("https://evil.example/a.png", "u1"), null);
  assert.equal(
    projectUserAvatar("/api/library/not-a-uuid?preview=1", "u1"),
    null
  );
  assert.equal(projectUserAvatar("/api/files/xyz", "u1"), null);
});

test("share token is base64url with sufficient entropy", () => {
  const token = generateShareToken();

  // 24 bytes → 32 字符 base64url（无填充）
  assert.equal(token.length, 32);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  // 不含需要 URL 编码的字符
  assert.equal(encodeURIComponent(token), token);

  const another = generateShareToken();
  assert.notEqual(token, another);
});

test("share token hash is deterministic sha256 hex", () => {
  const token = generateShareToken();
  const hash = hashShareToken(token);

  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, hashShareToken(token));
  assert.notEqual(hash, hashShareToken("另一个 token"));
});

test("sameShareTokenHash compares in constant time and rejects mismatches", () => {
  const token = generateShareToken();
  const hash = hashShareToken(token);

  assert.equal(sameShareTokenHash(hash, hashShareToken(token)), true);
  assert.equal(sameShareTokenHash(hash, hashShareToken("wrong")), false);
  // 长度不同直接拒绝，不抛错
  assert.equal(sameShareTokenHash(hash, "abc"), false);
  assert.equal(sameShareTokenHash("", ""), false);
});

test("share invite TTL is 7 days", () => {
  assert.equal(SHARE_INVITE_TTL_DAYS, 7);
});
