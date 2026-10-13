import "../support/db-env";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
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
const dist = path.resolve(".next", path.basename(root));
const baselineDeclaration = await readFile("next-env.d.ts", "utf8");
await writeFile(
  path.join(root, "tsconfig.json"),
  JSON.stringify({ extends: "../tsconfig.json" })
);
const log = await open(path.join(root, "server.log"), "wx", 0o600);
const base = `http://localhost:${process.env.PIWORK_PROJECT_DOCUMENT_HTTP_PORT ?? "3017"}`;
const requestBase = base.replace("localhost", "127.0.0.1");
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", new URL(base).port],
  {
    detached: true,
    env: {
      ...process.env,
      AUTH_TRUST_HOST: "true",
      AUTH_URL: base,
      BLOB_READ_WRITE_TOKEN: "",
      NEXT_DIST_DIR: path.relative(process.cwd(), dist),
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
      SCHEDULED_TASKS_ENABLED: "false",
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
  fetch(`${requestBase}${url}`, {
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
  const deadline = Date.now() + 240_000;
  let ready = false;
  while (Date.now() < deadline && !ready && server.exitCode === null) {
    // biome-ignore lint/performance/noAwaitInLoops: bounded server readiness polling
    ready = await request("/api/projects")
      .then((probe) => probe.status === 200)
      .catch(() => false);
    if (!ready) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  assert.ok(ready, "isolated server did not start");
  await database.sql`UPDATE "Member" SET role='admin' WHERE "userId"=${owner}`;
  const settingsUrl = "/api/admin/upload-settings";
  const saveSettings = (maxFileSizeMB: unknown, authCookie = ownerCookie) =>
    request(settingsUrl, authCookie, {
      body: JSON.stringify({ maxFileSizeMB }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  assert.deepEqual(await (await request(settingsUrl)).json(), {
    maxFileSizeMB: 100,
  });
  assert.equal((await saveSettings(2, otherCookie)).status, 401);
  assert.equal((await saveSettings(0)).status, 400);
  assert.equal((await saveSettings(101)).status, 400);
  assert.equal((await saveSettings(1.5)).status, 400);
  await database.sql`UPDATE "Member" SET status='disabled' WHERE "userId"=${owner}`;
  assert.equal((await saveSettings(2)).status, 401);
  assert.equal((await request("/api/upload-settings")).status, 403);
  await database.sql`UPDATE "Member" SET status='enabled' WHERE "userId"=${owner}`;

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
    // Cross the proxy's former 10 MiB cutoff; the route must receive the full body.
    "x".repeat(11 * 1024 * 1024),
    "oversized.txt"
  );
  assert.equal(oversized.status, 400);
  assert.match(await oversized.text(), /未保存截断内容/);
  const oversizedFile = await upload(
    "x".repeat(100 * 1024 * 1024 + 1),
    "over-file-limit.txt"
  );
  assert.equal(oversizedFile.status, 400);
  assert.match(await oversizedFile.text(), /100\s*MB/);
  const [count] =
    await database.sql`SELECT count(*)::int AS count FROM "Source" WHERE "projectId"=${projectId}`;
  assert.equal(count.count, 1);
  const uploadLibrary = (size: number, library = true) => {
    const body = new FormData();
    body.set(
      "file",
      new File([new Uint8Array(size)], "retained.txt", { type: "text/plain" })
    );
    if (library) {
      body.set("library", "true");
    }
    return request("/api/files/upload", ownerCookie, { body, method: "POST" });
  };
  const existingResponse = await uploadLibrary(2 * 1024 * 1024);
  assert.equal(
    existingResponse.status,
    200,
    await existingResponse.clone().text()
  );
  const existingFile = await existingResponse.json();
  const [existingItem] =
    await database.sql`SELECT id FROM "LibraryItem" WHERE "userId"=${owner} AND url=${existingFile.url}`;
  assert.ok(existingItem);
  assert.equal((await saveSettings(1)).status, 200);
  assert.deepEqual(
    await (await request("/api/upload-settings", otherCookie)).json(),
    { maxFileSizeMB: 1 }
  );
  const [policy] =
    await database.sql`SELECT "maxFileSizeMB", "updatedBy" FROM "UploadSettings" WHERE id='default'`;
  assert.equal(policy.maxFileSizeMB, 1);
  assert.equal(policy.updatedBy, owner);
  const rejectedLibrary = await uploadLibrary(1024 * 1024 + 1);
  assert.equal(rejectedLibrary.status, 400);
  assert.match(await rejectedLibrary.text(), /1\s*MB/);
  assert.equal((await uploadLibrary(1024 * 1024 + 1, false)).status, 400);
  const rejectedProject = await upload(
    "x".repeat(1024 * 1024 + 1),
    "policy-limit.txt"
  );
  assert.equal(rejectedProject.status, 400);
  assert.match(await rejectedProject.text(), /1\s*MB/);
  const allowedBoundary = await uploadLibrary(1024 * 1024);
  assert.equal(allowedBoundary.status, 200);
  assert.equal((await request(`/api/library/${existingItem.id}`)).status, 200);
  assert.equal(
    (
      await request(`/api/library/${existingItem.id}/attachment`, ownerCookie, {
        method: "POST",
      })
    ).status,
    200
  );

  if (process.env.PIWORK_UPLOAD_BROWSER_TESTS === "1") {
    const { chromium, expect } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      await context.addCookies([
        {
          name: "authjs.session-token",
          url: base,
          value: ownerCookie.slice("authjs.session-token=".length),
        },
      ]);
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const evidenceDir = path.resolve("artifacts/upload-settings-qa");
      await mkdir(evidenceDir, { recursive: true });
      const navigation = await page.goto(`${base}/admin/settings`, {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      });
      assert.equal(navigation?.status(), 200);
      const input = page.locator("#upload-max-file-size");
      try {
        await input.waitFor({ state: "visible", timeout: 30_000 });
      } catch (error) {
        await page.screenshot({
          fullPage: true,
          path: path.join(evidenceDir, "failed.png"),
        });
        console.error(
          "Browser errors:",
          pageErrors,
          "Body:",
          (await page.locator("body").innerText()).slice(0, 2000)
        );
        throw error;
      }
      await expect(input).toHaveValue("1");
      const form = page.locator("form");
      const button = form.locator('button[type="submit"]');
      assert.equal(await button.isDisabled(), true);
      await page.screenshot({
        fullPage: true,
        path: path.join(evidenceDir, "desktop.png"),
      });
      await input.fill("0");
      await expect(input).toHaveAttribute("aria-invalid", "true");
      assert.equal(await button.isDisabled(), true);
      await input.fill("2");
      const saved = page.waitForResponse(
        (r) => r.url().endsWith(settingsUrl) && r.request().method() === "PATCH"
      );
      await button.click();
      assert.equal((await saved).status(), 200);
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>(
            'form button[type="submit"]'
          )?.disabled
      );
      await page.route(`**${settingsUrl}`, (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({
              body: "{}",
              contentType: "application/json",
              status: 503,
            })
          : route.continue()
      );
      await input.fill("3");
      await button.click();
      await form.getByRole("alert").waitFor({ state: "visible" });
      assert.equal(await input.inputValue(), "3");
      await page.unroute(`**${settingsUrl}`);
      await page.setViewportSize({ height: 844, width: 390 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        ),
        true
      );
      await form.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(evidenceDir, "mobile.png"),
      });
      await page.route(`**${settingsUrl}`, (route) =>
        route.fulfill({
          body: "{}",
          contentType: "application/json",
          status: 503,
        })
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await form.getByRole("alert").waitFor({ state: "visible" });
      assert.equal(await button.count(), 0);
      await page.unroute(`**${settingsUrl}`);
      const reloaded = page.waitForResponse(
        (r) => r.url().endsWith(settingsUrl) && r.status() === 200
      );
      await form.getByRole("button", { name: /重试|Retry/ }).click();
      await reloaded;
      await expect(input).toHaveValue("2");
      await context.close();
    } finally {
      await browser.close();
    }
  }
  // A missing table must not silently restore the 100 MB default.
  await database.sql`DROP TABLE "UploadSettings"`;
  assert.equal((await request(settingsUrl)).status, 503);
  assert.equal((await request("/api/upload-settings")).status, 503);
  assert.equal((await upload("small", "unavailable.txt")).status, 503);
  assert.equal((await uploadLibrary(1)).status, 503);
  passed = true;
  console.log(
    "PASS: isolated upload settings permissions/hot policy/boundaries/existing access/failure handling and project upload regression; no model calls"
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
  await rm(dist, { force: true, recursive: true });
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
