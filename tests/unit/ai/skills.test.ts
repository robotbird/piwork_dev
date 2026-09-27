import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { zipSync } from "fflate";
import {
  createProjectSkill,
  deleteProjectSkill,
  extractProjectSkillArchive,
  installProjectSkill,
  invokeSkill,
  loadProjectSkillSummaries,
  loadProjectSkills,
  parseSkillCommand,
  validateSkillName,
} from "../../../lib/ai/skills.ts";

test("creates and discovers a standard Pi skill", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "piwork-skills-"));

  try {
    const created = await createProjectSkill({
      cwd,
      description: "Summarizes weekly reports when a user requests a recap.",
      displayName: "Weekly Recap",
      instructions: "# Weekly recap\n\nReturn three concise bullets.",
      name: "weekly-recap",
    });
    const skillFile = await readFile(created.filePath, "utf8");
    const metadataFile = await readFile(
      join(cwd, ".pi/skills/weekly-recap/agents/openai.yaml"),
      "utf8"
    );

    assert.match(skillFile, /^---\nname: "weekly-recap"/);
    assert.match(skillFile, /# Weekly recap/);
    assert.match(metadataFile, /display_name: "Weekly Recap"/);

    const loaded = await loadProjectSkills(cwd);
    assert.equal(loaded.diagnostics.length, 0);
    assert.equal(loaded.skills.length, 1);
    assert.equal(loaded.skills[0]?.name, "weekly-recap");

    const summaries = await loadProjectSkillSummaries(cwd);
    assert.equal(summaries.skills[0]?.displayName, "Weekly Recap");
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("parses and formats explicit skill commands", () => {
  const command = parseSkillCommand("/weekly-recap focus on risks");
  assert.deepEqual(command, {
    instructions: "focus on risks",
    name: "weekly-recap",
  });

  const prompt = invokeSkill(
    [
      {
        content: "# Weekly recap\n\nReturn three concise bullets.",
        description: "Summarizes weekly reports.",
        filePath: "/skills/weekly-recap/SKILL.md",
        name: "weekly-recap",
      },
    ],
    "weekly-recap",
    command?.instructions
  );

  assert.match(prompt, /<skill name="weekly-recap"/);
  assert.match(prompt, /focus on risks/);
});

test("rejects unsafe skill names", () => {
  assert.throws(() => validateSkillName("../unsafe"));
  assert.throws(() => validateSkillName("Uppercase"));
  assert.throws(() => validateSkillName("clear"));
  assert.doesNotThrow(() => validateSkillName("safe-skill-2"));
});

test("installs and deletes an uploaded skill folder", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "piwork-skills-upload-"));

  try {
    const installed = await installProjectSkill({
      cwd,
      files: [
        {
          content: new TextEncoder().encode(
            [
              "---",
              "name: uploaded-skill",
              "description: Handles uploaded skill test requests.",
              "---",
              "",
              "# Uploaded skill",
            ].join("\n")
          ),
          path: "uploaded-skill/SKILL.md",
        },
        {
          content: new TextEncoder().encode("Supporting material"),
          path: "uploaded-skill/references/guide.md",
        },
      ],
    });

    assert.equal(installed.name, "uploaded-skill");
    assert.equal(
      await readFile(
        join(cwd, ".pi/skills/uploaded-skill/references/guide.md"),
        "utf8"
      ),
      "Supporting material"
    );

    await deleteProjectSkill("uploaded-skill", cwd);
    const loaded = await loadProjectSkills(cwd);
    assert.equal(loaded.skills.length, 0);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("rejects uploads with unsafe paths", async () => {
  await assert.rejects(() =>
    installProjectSkill({
      files: [
        {
          content: new TextEncoder().encode("invalid"),
          path: "../SKILL.md",
        },
      ],
    })
  );
});

test("extracts a skill ZIP with a top-level directory", () => {
  const archive = zipSync({
    "zip-skill/references/guide.md": new TextEncoder().encode("Guide"),
    "zip-skill/SKILL.md": new TextEncoder().encode(
      [
        "---",
        "name: zip-skill",
        "description: Handles ZIP upload test requests.",
        "---",
        "",
        "# ZIP skill",
      ].join("\n")
    ),
  });

  const files = extractProjectSkillArchive({
    content: archive,
    filename: "zip-skill.zip",
  });

  assert.deepEqual(
    new Set(files.map((file) => file.path)),
    new Set(["zip-skill/SKILL.md", "zip-skill/references/guide.md"])
  );
});

test("wraps a root-level SKILL.md using the ZIP filename", () => {
  const archive = zipSync({
    "SKILL.md": new TextEncoder().encode(
      [
        "---",
        "name: root-zip-skill",
        "description: Handles root ZIP upload test requests.",
        "---",
      ].join("\n")
    ),
  });

  const files = extractProjectSkillArchive({
    content: archive,
    filename: "root-zip-skill.zip",
  });

  assert.equal(files[0]?.path, "root-zip-skill/SKILL.md");
});

test("rejects path traversal in a skill ZIP", () => {
  const archive = zipSync({
    "../SKILL.md": new TextEncoder().encode("unsafe"),
  });

  assert.throws(() =>
    extractProjectSkillArchive({ content: archive, filename: "unsafe.zip" })
  );
});
