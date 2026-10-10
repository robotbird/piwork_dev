import { readFileSync, writeFileSync } from "node:fs";

const value = readFileSync(new URL("../assets/value.txt", import.meta.url), "utf8").trim();
const reference = readFileSync(new URL("../references/usage.txt", import.meta.url), "utf8").trim();
const result = `SKILL_SCRIPT_OK:${value}:${reference}`;
writeFileSync("skill-result.txt", result);
console.log(result);
