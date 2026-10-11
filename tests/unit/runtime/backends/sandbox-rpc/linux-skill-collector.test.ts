import "../../../../support/runtime-env";
import assert from "node:assert/strict";
import { cp, link, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import { snapshotSandboxSkills } from "@/lib/runtime/backends/sandbox-rpc/skills";

const enabled =
  process.platform === "darwin" &&
  process.env.PIWORK_SKILL_COLLECTOR_DOCKER_TEST === "1";
test("mac development collects full skill via Linux and rejects links/credentials", {
  skip: !enabled,
}, async () => {
  const root = await mkdtemp(
    path.join(process.cwd(), ".skill-collector-test-")
  );
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "development" });
  try {
    const dir = path.join(root, "sandbox-script");
    await cp(path.resolve("tests/fixtures/skills/sandbox-script"), dir, {
      recursive: true,
    });
    const { skills } = loadSkillsFromDir({ dir: root, source: "project" });
    const snapshots = await snapshotSandboxSkills(skills, { root });
    assert.equal(snapshots.length, 1);
    assert.ok(snapshots[0].files.some((file) => file.path === "SKILL.md"));
    assert.ok(
      snapshots[0].files.some((file) => file.path.startsWith("scripts/"))
    );
    await symlink("SKILL.md", path.join(dir, "linked.md"));
    await assert.rejects(
      snapshotSandboxSkills(skills, { root }),
      /linux-collector-failed/
    );
    await rm(path.join(dir, "linked.md"));
    await link(path.join(dir, "SKILL.md"), path.join(dir, "hardlink.md"));
    await assert.rejects(
      snapshotSandboxSkills(skills, { root }),
      /linux-collector-failed/
    );
    await rm(path.join(dir, "hardlink.md"));
    await writeFile(path.join(dir, ".env"), "secret");
    await assert.rejects(
      snapshotSandboxSkills(skills, { root }),
      /linux-collector-failed/
    );
    Object.assign(process.env, { NODE_ENV: "production" });
    await assert.rejects(
      snapshotSandboxSkills(skills, { root }),
      /linux-required/
    );
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Object.assign(process.env, { NODE_ENV: previous });
    }
    await rm(root, { force: true, recursive: true });
  }
});
