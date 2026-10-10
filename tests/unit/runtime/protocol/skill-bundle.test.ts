import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  hashSkillBundleManifest,
  MAX_SKILL_BUNDLE_BYTES,
  MAX_SKILL_BUNDLE_FILES,
  MAX_SKILL_FILE_BYTES,
  MAX_SKILL_MANIFEST_BYTES,
  parseSkillBundleManifest,
  type SkillBundleManifest,
  sandboxSkillDirectory,
  skillBundleManifestSchema,
} from "../../../../lib/runtime/protocol/skill-bundle";

function manifest(): SkillBundleManifest {
  return {
    files: [
      {
        kind: "regular",
        path: "SKILL.md",
        sha256: "a".repeat(64),
        sizeBytes: 10,
      },
      {
        kind: "regular",
        path: "scripts/report.py",
        sha256: "b".repeat(64),
        sizeBytes: 20,
      },
    ],
    name: "spreadsheet-report",
    schemaVersion: 1,
    skillId: randomUUID(),
    version: "1.0.0",
  };
}

function rejectsPath(path: string) {
  const value = manifest();
  value.files[1].path = path;
  assert.throws(() => hashSkillBundleManifest(value), path);
}

test("immutable bundle identity is canonical and never maps host paths", () => {
  const value = manifest();
  const before = structuredClone(value);
  const digest = hashSkillBundleManifest(value);
  assert.match(digest, /^[a-f0-9]{64}$/);
  // Freeze the v1 canonical hash contract: changing it requires a new version.
  assert.equal(
    hashSkillBundleManifest({
      ...value,
      skillId: "00000000-0000-4000-8000-000000000001",
    }),
    "b94905a8e3db5a42f212c6bd189d3d22c30ef129794b7d4db70e2420ca2d0d63"
  );
  assert.equal(
    hashSkillBundleManifest({ ...value, files: [...value.files].reverse() }),
    digest
  );
  assert.equal(
    sandboxSkillDirectory(value),
    `/opt/piwork/skills/${value.skillId}/${digest}`
  );
  assert.deepEqual(value, before);
  for (const change of [
    { skillId: randomUUID() },
    { version: "2.0.0" },
    { name: "other-skill" },
    {
      files: value.files.map((entry) => ({ ...entry, sha256: "c".repeat(64) })),
    },
    {
      files: value.files.map((entry) => ({
        ...entry,
        sizeBytes: entry.sizeBytes + 1,
      })),
    },
    {
      files: [value.files[0], { ...value.files[1], path: "scripts/other.py" }],
    },
  ]) {
    assert.notEqual(hashSkillBundleManifest({ ...value, ...change }), digest);
  }
});

test("rejects escaping, noncanonical and reserved paths", () => {
  for (const path of [
    "../script.py",
    "/tmp/script.py",
    "scripts/../script.py",
    "scripts//a.py",
    "scripts/./a.py",
    "scripts\\a.py",
    "C:/a.py",
    "scripts/%2e%2e/a.py",
    "scripts/a\u0000.py",
    "scripts/a\n.py",
    "scripts/cafe\u0301.py",
    "scripts/\ud800.py",
    "scripts/\ud801.py",
    ".git/config",
    ".pi/extensions/tool.ts",
    ".agents/skills/SKILL.md",
    ".ssh/id_rsa",
    "node_modules/x/index.js",
    ".env",
    ".ENV.local",
    "data/auth.json",
    "models.json",
    "credentials.json",
    `scripts/${"界".repeat(86)}.py`,
  ]) {
    rejectsPath(path);
  }
  const value = manifest();
  value.files[1].path = "references/使用说明.md";
  assert(skillBundleManifestSchema.safeParse(value).success);
});

test("rejects duplicate and file/directory collisions", () => {
  for (const path of ["SKILL.md", "skill.md", "scripts/report.py/child.py"]) {
    const value = manifest();
    value.files.push({ ...value.files[1], path });
    assert.throws(() => hashSkillBundleManifest(value));
  }
});

test("requires nonempty root instructions and forbids executable transport payloads", () => {
  const value = manifest();
  assert.throws(() =>
    hashSkillBundleManifest({ ...value, files: value.files.slice(1) })
  );
  assert.throws(() =>
    hashSkillBundleManifest({
      ...value,
      files: [{ ...value.files[0], sizeBytes: 0 }],
    })
  );
  for (const kind of ["symlink", "hardlink", "socket", "directory", "device"]) {
    assert.throws(() =>
      hashSkillBundleManifest({
        ...value,
        files: [{ ...value.files[0], kind }],
      })
    );
  }
  for (const extra of [
    { approved: true },
    { hostPath: "/etc" },
    { apiKey: "not-a-real-key" },
    { execute: () => undefined },
    { schemaVersion: 2 },
    { skillId: "../../host" },
  ]) {
    assert.throws(() => hashSkillBundleManifest({ ...value, ...extra }));
  }
  assert.throws(() =>
    hashSkillBundleManifest({
      ...value,
      files: [{ ...value.files[0], bytes: "script" }],
    })
  );
});

test("enforces file, aggregate byte and file count quotas before provisioning", () => {
  const value = manifest();
  for (const sizeBytes of [
    -1,
    0.5,
    Number.POSITIVE_INFINITY,
    MAX_SKILL_FILE_BYTES + 1,
  ]) {
    assert.throws(() =>
      hashSkillBundleManifest({
        ...value,
        files: [{ ...value.files[0], sizeBytes }],
      })
    );
  }
  const files = Array.from({ length: MAX_SKILL_BUNDLE_FILES + 1 }, (_, i) => ({
    ...value.files[0],
    path: i === 0 ? "SKILL.md" : `data/${i}.txt`,
    sizeBytes: 1,
  }));
  assert.throws(() => hashSkillBundleManifest({ ...value, files }));
  const large = files
    .slice(0, MAX_SKILL_BUNDLE_BYTES / MAX_SKILL_FILE_BYTES + 1)
    .map((entry) => ({ ...entry, sizeBytes: MAX_SKILL_FILE_BYTES }));
  assert.throws(() => hashSkillBundleManifest({ ...value, files: large }));
});

test("bounds wire bytes and array count before child validation", () => {
  const value = manifest();
  assert.deepEqual(parseSkillBundleManifest(JSON.stringify(value)), value);
  assert.throws(() => parseSkillBundleManifest("not json"));
  assert.throws(
    () => parseSkillBundleManifest(" ".repeat(MAX_SKILL_MANIFEST_BYTES + 1)),
    /manifest-too-large/
  );
  assert.throws(
    () =>
      parseSkillBundleManifest(
        JSON.stringify({
          ...value,
          files: new Array(MAX_SKILL_BUNDLE_FILES + 1).fill(null),
        })
      ),
    /file-count-limit/
  );
  assert.throws(
    () =>
      hashSkillBundleManifest({
        ...value,
        files: new Array(MAX_SKILL_BUNDLE_FILES + 1).fill(null),
      }),
    /file-count-limit/
  );
});
