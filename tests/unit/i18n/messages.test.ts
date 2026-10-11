import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import ts from "typescript";
import { createTranslator } from "use-intl/core";
import en from "../../../i18n/messages/en.json";
import zh from "../../../i18n/messages/zh.json";
import { roleDisplayText } from "../../../lib/admin/roles";
import { formatToolStatus } from "../../../lib/chat/tool-status";
import { fileCategory } from "../../../lib/documents/types";
import { getMessageByErrorCode } from "../../../lib/errors";
import { LocalizedError, translateMessage } from "../../../lib/i18n/messages";
import { describeSchedule } from "../../../lib/scheduler/display";

function flatten(value: object, prefix = ""): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, message] of Object.entries(value)) {
    if (typeof message === "string") {
      entries[`${prefix}${key}`] = message;
    } else {
      Object.assign(entries, flatten(message, `${prefix}${key}.`));
    }
  }
  return entries;
}

const catalogs = { en: flatten(en), zh: flatten(zh) };

test("both locales have identical keys and valid ICU messages with matching arguments", () => {
  assert.deepEqual(
    Object.keys(catalogs.en).sort(),
    Object.keys(catalogs.zh).sort()
  );
  const args = (message: string) =>
    [...message.matchAll(/\{(\w+)(?:\s*,|\})/g)].map((match) => match[1]);
  for (const [key, english] of Object.entries(catalogs.en)) {
    assert.deepEqual(
      [...new Set(args(english))].sort(),
      [...new Set(args(catalogs.zh[key]))].sort(),
      key
    );
  }
  for (const [locale, messages] of Object.entries({ en, zh })) {
    const t = createTranslator({
      locale,
      messages,
      onError: (error) => {
        throw error;
      },
    });
    const translate = t as (
      key: string,
      params: Record<string, string | number>
    ) => string;
    for (const [key, message] of Object.entries(
      catalogs[locale as "en" | "zh"]
    )) {
      const params: Record<string, string | number> = Object.fromEntries(
        args(message).map((name) => [
          name,
          /count|files|folders|hours|days|seconds|tokens|daily|monthly|total|limit|size/i.test(
            name
          )
            ? 2
            : "example",
        ])
      );
      assert.equal(typeof translate(key, params), "string", `${locale}.${key}`);
    }
  }
});

test("pure helpers localize schedules, errors and transient tool progress without changing identifiers", () => {
  const t = (
    key: string,
    params?: import("../../../lib/i18n").TranslationParams
  ) => translateMessage(key, params, "en");
  assert.equal(describeSchedule("0 9 * * *", t), "Daily at 09:00");
  assert.equal(describeSchedule("0 9 * * 1", t), "Every Monday at 09:00");
  assert.equal(describeSchedule("0 9 * * 1-5", t), "Weekdays at 09:00");
  assert.equal(describeSchedule("0 * * * *", t), "Every hour");
  assert.equal(describeSchedule("*/5 * * * *", t), "*/5 * * * *");
  assert.equal(
    formatToolStatus("start", "bash", { command: "date" }, false, t),
    "Run command: date…"
  );
  assert.equal(
    formatToolStatus("end", "mcp__server__tool", undefined, true, t),
    "server/tool failed"
  );
  assert.equal(fileCategory("report.xlsx", null), "spreadsheets");
  assert.equal(fileCategory("photo.png", "image/png"), "images");
  assert.equal(
    new LocalizedError("runtimeMessages.sourceCount").messageKey,
    "runtimeMessages.sourceCount"
  );
  assert.match(getMessageByErrorCode("forbidden:model", "zh"), /模型/);
  assert.match(getMessageByErrorCode("forbidden:model", "en"), /model/);
  const system = {
    code: "admin",
    description: "legacy",
    name: "legacy",
    type: "system" as const,
  };
  assert.equal(roleDisplayText(system, "name", t), "Administrator");
  assert.equal(
    roleDisplayText({ ...system, name: "管理员", type: "custom" }, "name", t),
    "管理员"
  );
  assert.equal(
    translateMessage("documents.archived", { count: 1 }, "en"),
    "Archived 1 file"
  );
  assert.equal(
    translateMessage("documents.archived", { count: 2 }, "en"),
    "Archived 2 files"
  );
});

function sources(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : /\.(ts|tsx)$/.test(entry.name)
        ? [path]
        : [];
  });
}

test("application UI has no hardcoded Chinese literals or English JSX display text", () => {
  const failures: string[] = [];
  for (const path of ["app", "components", "hooks", "artifacts"].flatMap(
    sources
  )) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true
    );
    function inspect(node: ts.Node) {
      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isJsxText(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node)) &&
        /\p{Script=Han}/u.test(node.text)
      ) {
        failures.push(
          `${relative(process.cwd(), path)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
        );
      }
      // Brand spelling and the version prefix are intentional, language-independent identifiers.
      if (
        ts.isJsxText(node) &&
        /[A-Za-z]/.test(node.text.trim()) &&
        !["PiWork", "piwork", "v"].includes(node.text.trim())
      ) {
        failures.push(
          `${relative(process.cwd(), path)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${node.text.trim()}`
        );
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
  }
  assert.deepEqual(failures, []);
});
