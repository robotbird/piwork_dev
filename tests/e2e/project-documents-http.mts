import "../support/db-env";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { createProjectDocumentDatabase } from "../support/project-documents/database";

// Upload/list API only. Independent schema/server/identities; never call a model.
assert.notEqual(process.env.NODE_ENV, "production");
const { POSTGRES_URL: sourceUrl, AUTH_SECRET: secret } = process.env;
assert.ok(sourceUrl);
assert.ok(secret);
const database = await createProjectDocumentDatabase(sourceUrl);
const root = await mkdtemp(path.resolve(".tmp-project-documents-http-"));
const baselineDeclaration = await readFile("next-env.d.ts", "utf8");
await writeFile(
  path.join(root, "tsconfig.json"),
  JSON.stringify({ extends: "../tsconfig.json" })
);
const log = await open(path.join(root, "server.log"), "wx", 0o600);
const base = `http://127.0.0.1:${process.env.PIWORK_PROJECT_DOCUMENT_HTTP_PORT ?? "3017"}`;
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", new URL(base).port],
  {
    detached: true,
    env: {
      ...process.env,
      AUTH_TRUST_HOST: "true",
      AUTH_URL: base,
      NEXT_DIST_DIR: path.relative(process.cwd(), path.join(root, "next")),
      NEXT_TSCONFIG_PATH: path.relative(
        process.cwd(),
        path.join(root, "tsconfig.json")
      ),
      NEXTAUTH_URL: base,
      NODE_ENV: "development",
      PIWORK_DURABLE_CHAT_ENABLED: "0",
      PIWORK_INFERENCE_URL: "",
      PIWORK_PROJECT_DOCUMENT_INPUTS_ENABLED: "1",
      PIWORK_RUNTIME_BACKEND: "",
      PIWORK_SANDBOX_PROVIDER: "",
      POSTGRES_URL: database.url,
      UPLOAD_DIR: path.join(root, "uploads"),
    },
    stdio: ["ignore", log.fd, log.fd],
  }
);
const exited = once(server, "exit");
const owner = crypto.randomUUID();
const stranger = crypto.randomUUID();
const projectId = crypto.randomUUID();
const cookie = async (id: string) =>
  `authjs.session-token=${await encode({ salt: "authjs.session-token", secret, token: { email: `${id}@document-http.test`, id, sub: id, type: "regular" } })}`;
const ownerCookie = await cookie(owner);
const otherCookie = await cookie(stranger);
let passed = false;
const request = (
  url: string,
  authCookie = ownerCookie,
  options: RequestInit = {}
) =>
  fetch(`${base}${url}`, {
    ...options,
    headers: { ...options.headers, Cookie: authCookie },
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
  });
const upload = (
  content: string,
  name = "全部场景.txt",
  authCookie = ownerCookie
) => {
  const body = new FormData();
  body.set("file", new File([content], name, { type: "text/plain" }));
  return request(`/api/projects/${projectId}/sources`, authCookie, {
    body,
    method: "POST",
  });
};
try {
  for (const id of [owner, stranger]) {
    // biome-ignore lint/performance/noAwaitInLoops: users precede dependent members
    await database.sql`INSERT INTO "User" (id,email) VALUES (${id},${`${id}@document-http.test`})`;
    await database.sql`INSERT INTO "Member" ("userId",status) VALUES (${id},'enabled')`;
  }
  await database.sql`INSERT INTO "Project" (id,"userId",name) VALUES (${projectId},${owner},'isolated document HTTP')`;
  const deadline = Date.now() + 120_000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    // biome-ignore lint/performance/noAwaitInLoops: bounded server readiness polling
    ready = await request("/api/projects")
      .then((probe) => probe.status === 200)
      .catch(() => false);
    if (!ready) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  assert.ok(ready, "isolated server did not start");
  const content = `  ${"航空场景资料\n".repeat(25_000)}场景42：末尾证据  `;
  const response = await upload(content);
  assert.equal(response.status, 201, await response.clone().text());
  const { source } = await response.json();
  const [stored] =
    await database.sql`SELECT content FROM "Source" WHERE id=${source.id}`;
  assert.equal(stored.content, content);
  const listing = await request(`/api/projects/${projectId}/sources`);
  assert.equal(listing.status, 200);
  const { sources } = await listing.json();
  assert.equal(sources[0].textChars, Array.from(content).length);
  assert.equal(sources[0].storedTextTruncated, false);
  assert.equal(
    (await upload("unauthorized", "bad.txt", otherCookie)).status,
    404
  );
  const oversized = await upload(
    "x".repeat(2 * 1024 * 1024 + 1),
    "oversized.txt"
  );
  assert.equal(oversized.status, 400);
  assert.match(await oversized.text(), /未保存截断内容/);
  const [count] =
    await database.sql`SELECT count(*)::int AS count FROM "Source" WHERE "projectId"=${projectId}`;
  assert.equal(count.count, 1);
  passed = true;
  console.log(
    "PASS: authenticated HTTP upload preserves >150k text, list metadata matches, oversize/unauthorized requests rejected; no model calls"
  );
} finally {
  if (server.pid && server.exitCode === null) {
    process.kill(-server.pid, "SIGTERM");
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (server.exitCode === null) {
      process.kill(-server.pid, "SIGKILL");
      await exited;
    }
  }
  await log.close();
  const declaration = await readFile("next-env.d.ts", "utf8");
  if (declaration.includes(path.basename(root))) {
    await writeFile("next-env.d.ts", baselineDeclaration);
  }
  await database.close();
  if (passed) {
    await rm(root, { force: true, recursive: true });
  } else {
    console.error(`HTTP evidence retained: ${root}`);
  }
}
