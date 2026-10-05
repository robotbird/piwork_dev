import "../support/db-env";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { encode } from "next-auth/jwt";
import postgres from "postgres";

const base = process.env.LIBRARY_TEST_URL ?? "http://localhost:3000";
const secret = process.env.AUTH_SECRET;
assert.ok(secret, "AUTH_SECRET is required for local HTTP integration tests");
const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const storedPaths: string[] = [];
const token = async (id: string) =>
  `authjs.session-token=${await encode({ salt: "authjs.session-token", secret, token: { email: `library-http-${id}@test.local`, id, sub: id, type: "regular" } })}`;
const ownerCookie = await token(owner);
const otherCookie = await token(other);
function request(url: string, cookie = ownerCookie, options: RequestInit = {}) {
  return fetch(`${base}${url}`, {
    ...options,
    headers: { ...options.headers, Cookie: cookie },
    redirect: "manual",
  });
}
try {
  await sql`INSERT INTO "User" (id, email) VALUES (${owner}, ${`library-http-${owner}@test.local`}), (${other}, ${`library-http-${other}@test.local`})`;
  const folderResponse = await request("/api/library", ownerCookie, {
    body: JSON.stringify({ name: "HTTP 验收目录" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(folderResponse.status, 200);
  const folder = await folderResponse.json();
  const form = new FormData();
  const content = "arbitrary binary extension supported";
  form.append("file", new File([content], "验收文件.zip"));
  form.append("library", "true");
  form.append("parentId", folder.id);
  const uploaded = await request("/api/files/upload", ownerCookie, {
    body: form,
    method: "POST",
  });
  assert.equal(uploaded.status, 200);
  const file = await uploaded.json();
  if (file.url.startsWith("/api/files/")) {
    storedPaths.push(file.pathname);
  }
  const listing = await request("/api/library");
  assert.equal(listing.status, 200);
  const items = await listing.json();
  const item = items.find(
    (entry: { name: string }) => entry.name === "验收文件.zip"
  );
  assert.ok(item);
  assert.equal(item.parentId, folder.id);
  const download = await request(`/api/library/${item.id}`);
  assert.equal(download.status, 200);
  assert.equal(await download.text(), content);
  assert.ok(
    download.headers.get("Content-Disposition")?.startsWith("attachment")
  );
  assert.equal(
    (await request(`/api/library/${item.id}`, otherCookie)).status,
    404
  );
  assert.equal((await request(file.url, otherCookie)).status, 404);
  assert.equal((await request(file.url)).status, 200);
  assert.deepEqual(
    await (await request("/api/library", otherCookie)).json(),
    []
  );
  const wrongFolder = await request("/api/library", otherCookie, {
    body: JSON.stringify({ name: "invalid", parentId: folder.id }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(wrongFolder.status, 400);
  const rename = await request(`/api/library/${item.id}`, ownerCookie, {
    body: JSON.stringify({ name: "已验收.zip" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(rename.status, 200);
  const moved = await request(`/api/library/${item.id}`, ownerCookie, {
    body: JSON.stringify({ parentId: null }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert.equal(moved.status, 200);
  assert.equal((await moved.json()).parentId, null);
  assert.equal(
    (
      await request(`/api/library/${item.id}/attachment`, ownerCookie, {
        method: "POST",
      })
    ).status,
    400
  );
  assert.equal(
    (
      await request(`/api/library/${item.id}/attachment`, otherCookie, {
        method: "POST",
      })
    ).status,
    404
  );
  assert.equal(
    (
      await request(`/api/library/${folder.id}/attachment`, ownerCookie, {
        method: "POST",
      })
    ).status,
    404
  );
  assert.equal(
    (
      await request("/api/library/not-a-uuid/attachment", ownerCookie, {
        method: "POST",
      })
    ).status,
    400
  );
  const textForm = new FormData();
  textForm.append(
    "file",
    new File(["document library question answering"], "问答资料.txt", {
      type: "text/plain",
    })
  );
  textForm.append("library", "true");
  const textUpload = await request("/api/files/upload", ownerCookie, {
    body: textForm,
    method: "POST",
  });
  assert.equal(textUpload.status, 200);
  const textFile = await textUpload.json();
  if (textFile.url.startsWith("/api/files/")) {
    storedPaths.push(textFile.pathname);
  }
  const textItems = await (await request("/api/library")).json();
  const textItem = textItems.find(
    (entry: { name: string }) => entry.name === "问答资料.txt"
  );
  assert.ok(textItem);
  const resolved = await request(
    `/api/library/${textItem.id}/attachment`,
    ownerCookie,
    { method: "POST" }
  );
  assert.equal(resolved.status, 200);
  assert.deepEqual(await resolved.json(), {
    contentType: "text/plain",
    name: "问答资料.txt",
    url: textFile.url,
  });
  assert.equal(
    (
      await request(`/api/library/${textItem.id}/attachment`, otherCookie, {
        method: "POST",
      })
    ).status,
    404
  );
  const noteId = crypto.randomUUID();
  await sql`INSERT INTO "Document" (id,"createdAt",title,content,"text","userId") VALUES (${noteId},now(),'问答笔记','# 笔记内容','text',${owner})`;
  await sql`INSERT INTO "LibraryItem" (id,"documentId","userId",name,kind,source,"contentType",size) VALUES (${noteId},${noteId},${owner},'问答笔记.md','file','manual','text/plain',20)`;
  const noteResolved = await request(
    `/api/library/${noteId}/attachment`,
    ownerCookie,
    { method: "POST" }
  );
  assert.equal(noteResolved.status, 200);
  const noteFile = await noteResolved.json();
  assert.equal(noteFile.name, "问答笔记.md");
  assert.equal(noteFile.contentType, "text/markdown");
  if (noteFile.url.startsWith("/api/files/")) {
    storedPaths.push(noteFile.url.slice("/api/files/".length));
  }
  assert.equal(await (await request(noteFile.url)).text(), "# 笔记内容");
  assert.equal((await request(noteFile.url, otherCookie)).status, 404);
  const badId = await request("/api/library/not-a-uuid");
  assert.equal(badId.status, 400);
  console.log(
    "PASS: HTTP upload, folder placement, download bytes, rename, move, cross-user isolation and invalid input"
  );
} finally {
  await sql`DELETE FROM "LibraryItem" WHERE "userId" IN (${owner}, ${other})`;
  await sql`DELETE FROM "Document" WHERE "userId" IN (${owner}, ${other})`;
  await sql`DELETE FROM "User" WHERE id IN (${owner}, ${other})`;
  await Promise.all(
    storedPaths.flatMap((file) => [
      rm(path.join(process.env.UPLOAD_DIR ?? ".uploads", file), {
        force: true,
      }),
      rm(path.join(process.env.UPLOAD_DIR ?? ".uploads", `${file}.json`), {
        force: true,
      }),
    ])
  );
  await sql.end();
}
