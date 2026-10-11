import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import { projectSourceReferences } from "@/lib/projects/document-inputs";
import type { RuntimeSpec } from "@/lib/runtime/protocol";
import { createProjectDocumentDatabase } from "../../support/project-documents/database";

const originalUrl = process.env.POSTGRES_URL;
assert.ok(originalUrl, "POSTGRES_URL required");
const fixture = await createProjectDocumentDatabase(originalUrl);
process.env.POSTGRES_URL = fixture.url;
const { loadAuthorizedProjectDocuments } = await import(
  "@/lib/db/project-document-queries"
);
const { getProjectDocumentSources, listSources } = await import(
  "@/lib/db/project-queries"
);
const owner = crypto.randomUUID();
const colleague = crypto.randomUUID();
const stranger = crypto.randomUUID();
const projectId = crypto.randomUUID();
const chatId = crypto.randomUUID();
const runId = crypto.randomUUID();
const document = {
  content: `${"x".repeat(60_001)}末尾`,
  id: crypto.randomUUID(),
  name: "完整文本.txt",
  type: "txt",
};
const grant = {
  projectId,
  sources: projectSourceReferences([document]),
  userId: colleague,
};
const input = {
  chatId,
  projectSources: grant,
  runId,
} as RuntimeSpec;
const { sql } = fixture;

test.before(async () => {
  for (const id of [owner, colleague, stranger]) {
    // biome-ignore lint/performance/noAwaitInLoops: create dependent fixtures in order
    await sql`INSERT INTO "User" (id,email) VALUES (${id},${`${id}@project-documents.test`})`;
    await sql`INSERT INTO "Member" ("userId",status) VALUES (${id},'enabled')`;
  }
  await sql`INSERT INTO "Project" (id,"userId",name) VALUES (${projectId},${owner},'isolated document project')`;
  await sql`INSERT INTO "ProjectCollaborator" ("projectId","userId","invitedBy") VALUES (${projectId},${colleague},${owner})`;
  await sql`INSERT INTO "Source" (id,"projectId",name,type,content) VALUES (${document.id},${projectId},${document.name},${document.type},${document.content})`;
  await sql`INSERT INTO "Chat" (id,"projectId","userId",title,"createdAt","updatedAt") VALUES (${chatId},${projectId},${colleague},'isolated document chat',now(),now())`;
  await sql`INSERT INTO "AgentRun" (id,"chatId","userId",status,backend) VALUES (${runId},${chatId},${colleague},'starting','sandbox_rpc')`;
});
test.after(async () => {
  process.env.POSTGRES_URL = originalUrl;
  await fixture.close();
});

test("content query checks enabled project membership and returns full text + stable IDs", async () => {
  assert.deepEqual(await getProjectDocumentSources(stranger, projectId), []);
  assert.deepEqual(await getProjectDocumentSources(owner, projectId), [
    document,
  ]);
  assert.deepEqual(await loadAuthorizedProjectDocuments(input), [document]);
  const summaries = await listSources(colleague, projectId);
  assert.equal(summaries?.[0].textChars, document.content.length);
  assert.equal(summaries?.[0].storedTextTruncated, false);
});

test("actual actor/run/backend/chat/project and formal membership are required", async () => {
  await assert.rejects(
    loadAuthorizedProjectDocuments({
      ...input,
      projectSources: { ...grant, userId: stranger },
    })
  );
  await assert.rejects(
    loadAuthorizedProjectDocuments({ ...input, chatId: crypto.randomUUID() })
  );
  await assert.rejects(
    loadAuthorizedProjectDocuments({
      ...input,
      projectSources: {
        ...grant,
        projectId: crypto.randomUUID(),
      },
    })
  );
  for (const status of ["settled", "failed", "aborted"]) {
    // biome-ignore lint/performance/noAwaitInLoops: each state transition must precede its authorization check
    await sql`UPDATE "AgentRun" SET status=${status} WHERE id=${runId}`;
    await assert.rejects(loadAuthorizedProjectDocuments(input));
  }
  await sql`UPDATE "AgentRun" SET status='starting',backend='durable_sandbox' WHERE id=${runId}`;
  await assert.rejects(loadAuthorizedProjectDocuments(input));
  await sql`UPDATE "AgentRun" SET backend='sandbox_rpc' WHERE id=${runId}`;
  await sql`UPDATE "Member" SET status='disabled' WHERE "userId"=${colleague}`;
  await assert.rejects(loadAuthorizedProjectDocuments(input));
  assert.deepEqual(await getProjectDocumentSources(colleague, projectId), []);
  await sql`UPDATE "Member" SET status='enabled' WHERE "userId"=${colleague}`;
  await sql`UPDATE "User" SET "isAnonymous"=true WHERE id=${colleague}`;
  await assert.rejects(loadAuthorizedProjectDocuments(input));
  await sql`UPDATE "User" SET "isAnonymous"=false WHERE id=${colleague}`;
  await sql`DELETE FROM "ProjectCollaborator" WHERE "projectId"=${projectId} AND "userId"=${colleague}`;
  await assert.rejects(loadAuthorizedProjectDocuments(input));
});
