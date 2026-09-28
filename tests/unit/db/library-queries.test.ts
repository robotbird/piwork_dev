import "../../support/db-env";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import postgres from "postgres";
import { createDeliverFileTool } from "../../../lib/ai/agent-tools";
import { getChatFileId } from "../../../lib/ai/attachment-types";
import { readLocalFile } from "../../../lib/ai/file-store";
import {
  assertLibraryFolder,
  canReadStoredFile,
  createLibraryFolder,
  getLibraryItem,
  listLibraryItems,
  readLibraryDocument,
  registerGeneratedFile,
  registerLibraryFile,
  renameLibraryItem,
} from "../../../lib/db/library-queries";
import { saveDocument } from "../../../lib/db/queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const dbTest = process.env.POSTGRES_URL ? test : test.skip;
const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const chatId = crypto.randomUUID();
let directory = "";
let previousDir: string | undefined;
let previousToken: string | undefined;
test.before(async () => {
  if (!process.env.POSTGRES_URL) {
    return;
  }
  await sql`INSERT INTO "User" (id, email) VALUES (${owner}, ${`library-${owner}@test.local`}), (${other}, ${`library-${other}@test.local`})`;
  await sql`INSERT INTO "Chat" (id, "userId", title, "createdAt") VALUES (${chatId}, ${owner}, 'library-test', NOW())`;
  directory = await mkdtemp(path.join(tmpdir(), "piwork-library-"));
  previousDir = process.env.UPLOAD_DIR;
  previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.UPLOAD_DIR = path.join(directory, "uploads");
  delete process.env.BLOB_READ_WRITE_TOKEN;
});
test.after(async () => {
  if (!process.env.POSTGRES_URL) {
    return;
  }
  await sql`DELETE FROM "LibraryItem" WHERE "userId" IN (${owner}, ${other})`;
  await sql`DELETE FROM "Document" WHERE "userId" IN (${owner}, ${other})`;
  await sql`DELETE FROM "Chat" WHERE id = ${chatId}`;
  await sql`DELETE FROM "User" WHERE id IN (${owner}, ${other})`;
  await sql.end();
  await rm(directory, { force: true, recursive: true });
  if (previousDir) {
    process.env.UPLOAD_DIR = previousDir;
  } else {
    delete process.env.UPLOAD_DIR;
  }
  if (previousToken) {
    process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  }
});

dbTest("folders and file reads/renames are scoped to their owner", async () => {
  const folder = await createLibraryFolder(owner, "合同审核", null);
  await assert.rejects(assertLibraryFolder(other, folder.id));
  const file = {
    contentType: "application/octet-stream",
    name: "合同.docx",
    pathname: "contract.docx",
    url: "/api/files/contract.docx",
  };
  await assert.rejects(
    registerLibraryFile({
      file,
      parentId: folder.id,
      size: 5,
      source: "upload",
      userId: other,
    })
  );
  const item = await registerLibraryFile({
    file,
    parentId: folder.id,
    size: 5,
    source: "upload",
    userId: owner,
  });
  assert.equal(await getLibraryItem(other, item.id), undefined);
  assert.equal(await renameLibraryItem(other, item.id, "stolen"), undefined);
  assert.equal(await canReadStoredFile(other, file.url), false);
  assert.equal(await canReadStoredFile(owner, file.url), true);
  assert.equal((await listLibraryItems(other)).length, 0);
  assert.equal(
    (await renameLibraryItem(owner, item.id, "已审核.docx"))?.name,
    "已审核.docx"
  );
  await registerLibraryFile({ file, size: 5, source: "upload", userId: owner });
  assert.equal(
    (await listLibraryItems(owner)).filter((row) => row.id === item.id).length,
    1
  );
});

dbTest("Pi deliver_file archives bytes before notifying the user", async () => {
  await writeFile(path.join(directory, "generated.txt"), "AI output");
  let archived = false;
  let delivered = false;
  const tool = createDeliverFileTool({
    onDelivered: () => {
      assert.equal(archived, true);
      delivered = true;
    },
    onStored: async (file, size) => {
      await registerGeneratedFile(chatId, file, size);
      const bytes = await readLocalFile(getChatFileId(file.url)!);
      assert.equal(bytes?.content.toString(), "AI output");
      archived = true;
    },
    workspaceDir: directory,
  });
  await tool.execute("test", { path: "generated.txt" });
  assert.equal(delivered, true);
  const generated = (await listLibraryItems(owner)).find(
    (row) => row.name === "generated.txt"
  );
  assert.equal(generated?.source, "ai");
  assert.equal(generated?.size, 9);
});

dbTest("archive failure does not report a successful delivery", async () => {
  let delivered = false;
  const tool = createDeliverFileTool({
    onDelivered: () => {
      delivered = true;
    },
    onStored: () => Promise.reject(new Error("archive unavailable")),
    workspaceDir: directory,
  });
  await assert.rejects(
    tool.execute("test", { path: "generated.txt" }),
    /archive unavailable/
  );
  assert.equal(delivered, false);
});

dbTest(
  "Document versions appear once and download the latest content",
  async () => {
    const id = crypto.randomUUID();
    await saveDocument({
      content: "version one",
      id,
      kind: "text",
      title: "经营分析",
      userId: owner,
    });
    await saveDocument({
      content: "version two",
      id,
      kind: "text",
      title: "经营分析",
      userId: owner,
    });
    assert.equal(
      (await listLibraryItems(owner)).filter((row) => row.id === id).length,
      1
    );
    assert.equal(
      (await readLibraryDocument(owner, id))?.content,
      "version two"
    );
    assert.equal(await readLibraryDocument(other, id), undefined);
  }
);
