import { createHash } from "node:crypto";
import { z } from "zod";
import { isSafeWorkspacePath } from "./run-descriptor";

export const SKILL_BUNDLE_VERSION = 1;
export const MAX_SKILL_BUNDLE_FILES = 512;
export const MAX_SKILL_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_SKILL_BUNDLE_BYTES = 50 * 1024 * 1024;
export const MAX_SKILL_MANIFEST_BYTES = 1024 * 1024;
export const SKILL_SANDBOX_ROOT = "/opt/piwork/skills";

const FORBIDDEN_SEGMENTS = new Set([
  ".git",
  ".pi",
  ".agents",
  ".ssh",
  "node_modules",
  ".env",
  "auth.json",
  "models.json",
  "credentials.json",
]);

/** Transport metadata only. The trusted collector must independently verify
 * actual regular files, reject links and hash bounded bytes. This schema does
 * not prove filesystem safety, approval, ownership or permission to execute.
 */
const file = z.strictObject({
  kind: z.literal("regular"),
  path: z
    .string()
    .refine(
      (value) =>
        isSafeWorkspacePath(value) &&
        value.isWellFormed() &&
        value
          .split("/")
          .every(
            (part) =>
              Buffer.byteLength(part, "utf8") <= 255 &&
              !FORBIDDEN_SEGMENTS.has(part.toLowerCase()) &&
              !part.toLowerCase().startsWith(".env.")
          ),
      "Unsafe or reserved skill file path"
    ),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().min(0).max(MAX_SKILL_FILE_BYTES),
});

export const skillBundleManifestSchema = z
  .strictObject({
    files: z.array(file).min(1).max(MAX_SKILL_BUNDLE_FILES),
    name: z
      .string()
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    schemaVersion: z.literal(SKILL_BUNDLE_VERSION),
    skillId: z.uuid(),
    version: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  })
  .superRefine((manifest, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message, path: ["files"] });
    const paths = new Set<string>();
    let total = 0;
    for (const entry of manifest.files) {
      const key = entry.path.toLowerCase();
      if (paths.has(key)) {
        issue("Duplicate or case-colliding file path");
      }
      paths.add(key);
      total += entry.sizeBytes;
    }
    if (total > MAX_SKILL_BUNDLE_BYTES) {
      issue("Skill bundle byte limit exceeded");
    }
    if (
      !manifest.files.some(
        (entry) => entry.path === "SKILL.md" && entry.sizeBytes > 0
      )
    ) {
      issue("Nonempty root SKILL.md required");
    }
    for (const entry of manifest.files) {
      const parts = entry.path.toLowerCase().split("/");
      for (let count = 1; count < parts.length; count += 1) {
        if (paths.has(parts.slice(0, count).join("/"))) {
          issue("File/directory prefix collision");
        }
      }
    }
  });

export type SkillBundleManifest = z.infer<typeof skillBundleManifestSchema>;

function validateManifest(input: unknown): SkillBundleManifest {
  // Reject huge arrays before Zod visits each child or accumulates errors.
  if (
    input &&
    typeof input === "object" &&
    "files" in input &&
    Array.isArray(input.files) &&
    input.files.length > MAX_SKILL_BUNDLE_FILES
  ) {
    throw new Error("skill-bundle:file-count-limit");
  }
  const manifest = skillBundleManifestSchema.parse(input);
  if (
    Buffer.byteLength(JSON.stringify(manifest), "utf8") >
    MAX_SKILL_MANIFEST_BYTES
  ) {
    throw new Error("skill-bundle:manifest-too-large");
  }
  return manifest;
}

/** Bound encoded metadata before JSON decoding. HTTP callers must also enforce
 * body limits before buffering; no approval is created by successful parsing.
 */
export function parseSkillBundleManifest(wire: string): SkillBundleManifest {
  if (Buffer.byteLength(wire, "utf8") > MAX_SKILL_MANIFEST_BYTES) {
    throw new Error("skill-bundle:manifest-too-large");
  }
  return validateManifest(JSON.parse(wire));
}

/** Stable content identity: bind authorization to this hash, then verify every
 * file's real bytes on materialization. Neither a mutable name nor enabled=true
 * may substitute for a reviewed, immutable platform approval.
 */
export function hashSkillBundleManifest(input: unknown): string {
  const manifest = validateManifest(input);
  const canonical = {
    files: [...manifest.files].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    ),
    name: manifest.name,
    schemaVersion: manifest.schemaVersion,
    skillId: manifest.skillId,
    version: manifest.version,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Pure path projection, not provisioning or a grant. The provider must create
 * a separate read-only mount; chmod inside a writable workspace is insufficient.
 */
export function sandboxSkillDirectory(input: unknown): string {
  const manifest = validateManifest(input);
  return `${SKILL_SANDBOX_ROOT}/${manifest.skillId}/${hashSkillBundleManifest(manifest)}`;
}
