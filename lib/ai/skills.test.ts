import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createProjectSkill,
  invokeSkill,
  loadProjectSkillSummaries,
  loadProjectSkills,
  parseSkillCommand,
  validateSkillName,
} from "./skills.ts";

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
