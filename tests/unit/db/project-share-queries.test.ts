import "../../support/db-env";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  createProject,
  createProjectChat,
  createSource,
  deleteProject,
  deleteSource,
  getProject,
  getProjectSource,
  listProjectChats,
  listProjects,
  listSources,
  renameProject,
} from "../../../lib/db/project-queries";
import {
  addProjectCollaborators,
  checkShareInvite,
  createShareInvite,
  joinProjectShare,
  removeProjectCollaborator,
  revokeShareInvite,
} from "../../../lib/db/project-share-queries";

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
const owner = crypto.randomUUID();
const colleague = crypto.randomUUID();
const stranger = crypto.randomUUID();
test.before(async () => {
  await Promise.all(
    [owner, colleague, stranger].map(async (id) => {
      await sql`INSERT INTO "User" (id, email) VALUES (${id}, ${`${id}@project-share.test`})`;
      await sql`INSERT INTO "Member" ("userId", status) VALUES (${id}, 'enabled')`;
    })
  );
});
test.after(async () => {
  await Promise.all(
    (await listProjects(owner))
      .filter((p) => p.userId === owner)
      .map((p) => deleteProject(owner, p.id))
  );
  await sql`DELETE FROM "User" WHERE id IN (${owner}, ${colleague}, ${stranger})`;
  await sql.end();
});
test("project sharing exposes resources, preserves private chats and owner-only mutations; removal and disabling revoke access", async () => {
  const project = await createProject(owner, "isolated shared project");
  const source = await createSource(owner, project.id, {
    content: "shared data",
    name: "note.txt",
    type: "txt",
  });
  assert.ok(source);
  await createProjectChat({
    projectId: project.id,
    title: "owner private",
    userId: owner,
  });
  assert.equal(await getProject(colleague, project.id), null);
  await addProjectCollaborators(project.id, owner, [colleague]);
  assert.ok(await getProject(colleague, project.id));
  assert.equal(
    (await listProjects(colleague)).find((p) => p.id === project.id)?.isOwner,
    false
  );
  assert.equal((await listSources(colleague, project.id))?.length, 1);
  assert.equal(
    (await getProjectSource(colleague, project.id, source.id))?.content,
    "shared data"
  );
  assert.equal(await getProjectSource(stranger, project.id, source.id), null);
  assert.equal(await renameProject(colleague, project.id, "forbidden"), null);
  assert.equal(await deleteProject(colleague, project.id), null);
  assert.equal(await deleteSource(colleague, project.id, source.id), null);
  assert.equal(
    await createSource(colleague, project.id, {
      content: "forbidden",
      name: "bad.txt",
      type: "txt",
    }),
    null
  );
  const personal = await createProjectChat({
    projectId: project.id,
    title: "colleague private",
    userId: colleague,
  });
  assert.deepEqual(
    (await listProjectChats(colleague, project.id)).map((c) => c.chatId),
    [personal.id]
  );
  assert.equal((await listProjectChats(owner, project.id)).length, 1);
  await sql`UPDATE "Member" SET status = 'disabled' WHERE "userId" = ${colleague}`;
  assert.equal(await getProject(colleague, project.id), null);
  assert.equal((await listProjects(colleague)).length, 0);
  await sql`UPDATE "Member" SET status = 'enabled' WHERE "userId" = ${colleague}`;
  await removeProjectCollaborator(project.id, colleague);
  assert.equal(await getProject(colleague, project.id), null);
  assert.equal(await listSources(colleague, project.id), null);
  assert.equal(await getProjectSource(colleague, project.id, source.id), null);
});
test("project invitations hash tokens, expire, rotate, revoke and join only enabled members", async () => {
  const project = await createProject(owner, "isolated invite project");
  const first = await createShareInvite(project.id, owner);
  const [stored] =
    await sql`SELECT "tokenHash" FROM "ProjectShareInvite" WHERE "projectId" = ${project.id}`;
  assert.notEqual(stored.tokenHash, first.token);
  assert.equal(stored.tokenHash.length, 64);
  assert.equal(await checkShareInvite(project.id, "wrong"), null);
  assert.equal(await joinProjectShare(project.id, colleague, "wrong"), false);
  await assert.rejects(
    createShareInvite(project.id, colleague, { replaceActive: true })
  );
  const rotated = await createShareInvite(project.id, owner, {
    replaceActive: true,
  });
  assert.equal(await checkShareInvite(project.id, first.token), null);
  await sql`UPDATE "Member" SET status = 'disabled' WHERE "userId" = ${colleague}`;
  assert.equal(
    await joinProjectShare(project.id, colleague, rotated.token),
    false
  );
  await sql`UPDATE "Member" SET status = 'enabled' WHERE "userId" = ${colleague}`;
  assert.equal(
    await joinProjectShare(project.id, colleague, rotated.token),
    true
  );
  assert.equal(
    await joinProjectShare(project.id, colleague, rotated.token),
    true
  );
  assert.ok(await getProject(colleague, project.id));
  await revokeShareInvite(project.id);
  assert.equal(
    await joinProjectShare(project.id, stranger, rotated.token),
    false
  );
  const expired = await createShareInvite(project.id, owner);
  await sql`UPDATE "ProjectShareInvite" SET "expiresAt" = NOW() - interval '1 day' WHERE "projectId" = ${project.id}`;
  assert.equal(await checkShareInvite(project.id, expired.token), null);
  assert.equal(
    await joinProjectShare(project.id, stranger, expired.token),
    false
  );
});
