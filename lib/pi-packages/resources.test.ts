import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  collectPackageSkillFiles,
  countPackageResourceFiles,
  discoverPackageSkillDirs,
  MAX_PACKAGE_SKILL_FILE_COUNT,
  readPiManifest,
} from "./resources.ts";

async function createFixturePackage(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "piwork-pi-pkg-"));
  await mkdir(join(root, "skills/echo-skill"), { recursive: true });
  await mkdir(join(root, "skills/nested/deep-skill"), { recursive: true });
  await mkdir(join(root, "skills/echo-skill/agents"), { recursive: true });
  await writeFile(
    join(root, "skills/echo-skill/SKILL.md"),
    "---\nname: echo-skill\ndescription: Echo\n---\nEcho instructions.\n"
  );
  await writeFile(
    join(root, "skills/echo-skill/agents/openai.yaml"),
    "interface:\n  display_name: Echo\n"
  );
  await writeFile(
    join(root, "skills/nested/deep-skill/SKILL.md"),
    "---\nname: deep-skill\ndescription: Deep\n---\nDeep instructions.\n"
  );
  return root;
}

test("readPiManifest 解析 pi 键并只接受字符串数组字段", async () => {
  const root = await createFixturePackage();
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "fixture",
        pi: {
          extensions: ["./ext.ts"],
          prompts: "not-an-array",
          skills: ["./skills"],
        },
      })
    );
    const manifest = await readPiManifest(root);
    assert.deepEqual(manifest?.skills, ["./skills"]);
    assert.deepEqual(manifest?.extensions, ["./ext.ts"]);
    // prompts 非数组 → 该字段被丢弃
    assert.equal(manifest?.prompts, undefined);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("readPiManifest 缺少 package.json 或 pi 键时返回 null", async () => {
  const root = await createFixturePackage();
  try {
    assert.equal(await readPiManifest(root), null);
    await writeFile(join(root, "package.json"), JSON.stringify({}));
    assert.equal(await readPiManifest(root), null);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("manifest 目录条目递归发现技能目录,文件条目取其所在目录", async () => {
  const root = await createFixturePackage();
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ pi: { skills: ["./skills"] } })
    );
    const dirs = await discoverPackageSkillDirs(
      root,
      await readPiManifest(root)
    );
    assert.equal(dirs.length, 2);
    assert.ok(dirs.some((dir) => dir.endsWith("echo-skill")));
    assert.ok(dirs.some((dir) => dir.endsWith("deep-skill")));

    // 直接指向 SKILL.md 文件
    const manifest = await readPiManifest(root);
    if (manifest?.skills) {
      manifest.skills = ["./skills/echo-skill/SKILL.md"];
    }
    const fileDirs = await discoverPackageSkillDirs(root, manifest);
    assert.equal(fileDirs.length, 1);
    assert.ok(fileDirs[0].endsWith("echo-skill"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("无 manifest 时回退 skills/ 约定目录,无技能则返回空", async () => {
  const root = await createFixturePackage();
  try {
    const dirs = await discoverPackageSkillDirs(root, null);
    assert.equal(dirs.length, 2);

    const emptyRoot = await mkdtemp(join(tmpdir(), "piwork-pi-empty-"));
    try {
      await writeFile(
        join(emptyRoot, "package.json"),
        JSON.stringify({ name: "no-resources" })
      );
      assert.deepEqual(await discoverPackageSkillDirs(emptyRoot, null), []);
    } finally {
      await rm(emptyRoot, { force: true, recursive: true });
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("collectPackageSkillFiles 收集相对路径并跳过隐藏与 node_modules", async () => {
  const root = await createFixturePackage();
  try {
    const skillDir = join(root, "skills/echo-skill");
    await mkdir(join(skillDir, "node_modules/evil"), { recursive: true });
    await writeFile(join(skillDir, ".hidden.txt"), "hidden");
    await writeFile(join(skillDir, "node_modules/evil/SKILL.md"), "evil");
    const collected = await collectPackageSkillFiles(skillDir, root);
    assert.equal(collected.folderName, "echo-skill");
    const paths = collected.files.map((file) => file.path).sort();
    assert.deepEqual(paths, ["SKILL.md", "agents/openai.yaml"]);
    const manifestFile = collected.files.find(
      (file) => file.path === "SKILL.md"
    );
    assert.equal(manifestFile?.sourcePath, "skills/echo-skill/SKILL.md");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("collectPackageSkillFiles 强制文件数上限", async () => {
  const root = await createFixturePackage();
  try {
    const skillDir = join(root, "skills/echo-skill");
    for (let index = 0; index < MAX_PACKAGE_SKILL_FILE_COUNT; index += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: 构造 fixture 需逐个写文件
      await writeFile(join(skillDir, `file-${index}.txt`), "x");
    }
    await assert.rejects(
      () => collectPackageSkillFiles(skillDir, root),
      /file limit/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("countPackageResourceFiles 按 manifest 与约定目录清点", async () => {
  const root = await createFixturePackage();
  try {
    await mkdir(join(root, "extensions"), { recursive: true });
    await mkdir(join(root, "themes"), { recursive: true });
    await writeFile(join(root, "extensions/index.ts"), "export {};");
    await writeFile(join(root, "extensions/helper.js"), "export {};");
    await writeFile(join(root, "extensions/README.md"), "skip");
    await writeFile(join(root, "themes/dark.json"), "{}");
    await writeFile(join(root, "package.json"), JSON.stringify({}));

    const manifest = await readPiManifest(root);
    assert.equal(
      await countPackageResourceFiles(root, "extensions", manifest),
      2
    );
    assert.equal(await countPackageResourceFiles(root, "themes", manifest), 1);
    assert.equal(await countPackageResourceFiles(root, "prompts", manifest), 0);
    // skills 约定目录按 .md 通配清点:两个 SKILL.md(openai.yaml 非 .md)
    const skillCount = await countPackageResourceFiles(
      root,
      "skills",
      manifest
    );
    assert.equal(skillCount, 2);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
