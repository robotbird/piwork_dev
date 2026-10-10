// biome-ignore-all lint/performance/noAwaitInLoops: Serial traversal bounds memory/FDs; startup transfers must precede agent launch.
import "server-only";

import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, open, opendir, realpath } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter, type Skill } from "@earendil-works/pi-coding-agent";
import { buildSkillsSystemPrompt } from "@/lib/ai/skills";
import type { RuntimeSpec } from "../../protocol";
import {
  MAX_SKILL_BUNDLE_BYTES,
  MAX_SKILL_BUNDLE_FILES,
  MAX_SKILL_FILE_BYTES,
  skillBundleManifestSchema,
} from "../../protocol/skill-bundle";
import type { SandboxHandle } from "../../sandbox";

export type SkillSnapshot = {
  skill: Skill;
  files: { path: string; bytes: Uint8Array }[];
};

/** Host-only trusted catalog references. Linux pins directory fds throughout
 * traversal. The portable path reader is explicitly test-only, never production.
 * Snapshot all bytes before acquiring a sandbox; no host scripts are executed.
 */
export async function snapshotSandboxSkills(
  skills: readonly Skill[],
  options: { root?: string; allowNonLinuxForTests?: boolean } = {}
): Promise<SkillSnapshot[]> {
  if (!skills.length) {
    return [];
  }
  const linux = process.platform === "linux";
  if (
    !linux &&
    !(options.allowNonLinuxForTests && process.env.NODE_ENV === "test")
  ) {
    throw new Error("runtime:sandbox-skills:linux-required");
  }
  if (skills.length > 100) {
    throw new Error("runtime:sandbox-skills:count-limit");
  }
  const root = path.resolve(
    options.root ?? path.join(process.cwd(), ".pi/skills")
  );
  const seen = new Set<string>();
  const refs = skills.map((skill) => {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) ||
      skill.name.length > 64 ||
      seen.has(skill.name)
    ) {
      throw new Error("runtime:sandbox-skills:invalid-name");
    }
    seen.add(skill.name);
    const dir = path.join(root, skill.name);
    if (
      path.resolve(skill.baseDir) !== dir ||
      path.resolve(skill.filePath) !== path.join(dir, "SKILL.md")
    ) {
      throw new Error("runtime:sandbox-skills:unmanaged-source");
    }
    return { ...skill };
  });
  // Deployment may symlink the platform's root to shared storage. Resolve that
  // trusted root once, then prohibit links beneath it (including the skill dir).
  const canonicalRoot = await realpath(root);
  let count = 0;
  let directories = 0;
  let total = 0;
  const snapshots: SkillSnapshot[] = [];

  async function walk(
    dir: FileHandle,
    physical: string,
    prefix: string,
    files: SkillSnapshot["files"]
  ) {
    directories += 1;
    if (directories > MAX_SKILL_BUNDLE_FILES) {
      throw new Error("runtime:sandbox-skills:directory-limit");
    }
    const pinned = linux ? `/proc/self/fd/${dir.fd}` : physical;
    for await (const { name } of await opendir(pinned)) {
      const relative = prefix ? `${prefix}/${name}` : name;
      // Reuse strict logical path/credential exclusion from the transport schema.
      const check =
        skillBundleManifestSchema.shape.files.element.shape.path.safeParse(
          relative
        );
      if (!check.success) {
        throw new Error("runtime:sandbox-skills:unsafe-path");
      }
      const target = path.join(pinned, name);
      // O_NONBLOCK prevents a swapped FIFO from hanging open; fstat verifies type.
      const file = await open(
        target,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
      );
      try {
        const before = await file.stat({ bigint: true });
        if (before.isDirectory()) {
          await walk(file, path.join(physical, name), relative, files);
          continue;
        }
        if (!before.isFile() || before.nlink !== 1n) {
          throw new Error("runtime:sandbox-skills:unsupported-file");
        }
        const size = Number(before.size);
        count += 1;
        total += size;
        if (
          count > MAX_SKILL_BUNDLE_FILES ||
          size > MAX_SKILL_FILE_BYTES ||
          total > MAX_SKILL_BUNDLE_BYTES
        ) {
          throw new Error("runtime:sandbox-skills:byte-or-file-limit");
        }
        const buffer = Buffer.alloc(size + 1);
        let offset = 0;
        while (offset < buffer.length) {
          const { bytesRead } = await file.read(
            buffer,
            offset,
            buffer.length - offset,
            offset
          );
          if (!bytesRead) {
            break;
          }
          offset += bytesRead;
        }
        const after = await file.stat({ bigint: true });
        if (
          offset !== size ||
          before.size !== after.size ||
          before.mtimeNs !== after.mtimeNs ||
          before.ctimeNs !== after.ctimeNs ||
          after.nlink !== 1n
        ) {
          throw new Error("runtime:sandbox-skills:source-changed");
        }
        files.push({ bytes: buffer.subarray(0, size), path: relative });
      } finally {
        await file.close();
      }
    }
  }

  // realpath above canonicalizes the trusted deployment root; pin its inode.
  const rootHandle = await open(
    canonicalRoot,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  );
  try {
    for (const skill of refs) {
      const physical = path.join(canonicalRoot, skill.name);
      const dir = await open(
        linux ? `/proc/self/fd/${rootHandle.fd}/${skill.name}` : physical,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
      );
      const files: SkillSnapshot["files"] = [];
      try {
        await walk(dir, physical, "", files);
      } finally {
        await dir.close();
      }
      const instructions = files.find((file) => file.path === "SKILL.md");
      if (!instructions) {
        throw new Error("runtime:sandbox-skills:instructions-missing");
      }
      const { frontmatter } = parseFrontmatter(
        Buffer.from(instructions.bytes).toString("utf8")
      );
      // Pi falls back to the containing directory name when name is absent.
      const declaredName =
        typeof frontmatter.name === "string" && frontmatter.name
          ? frontmatter.name
          : skill.name;
      if (
        declaredName !== skill.name ||
        typeof frontmatter.description !== "string" ||
        !frontmatter.description.trim()
      ) {
        throw new Error("runtime:sandbox-skills:instructions-mismatch");
      }
      snapshots.push({
        files,
        skill: {
          ...skill,
          description: frontmatter.description,
          disableModelInvocation:
            frontmatter["disable-model-invocation"] === true,
        },
      });
    }
  } finally {
    await rootHandle.close();
  }
  return snapshots;
}

/** Fresh sandbox, before Pi starts. Direct bounded files, no tar extraction,
 * package install, custom RPC tool bridge, or script execution on the host.
 * The copied directory is NOT a read-only mount or a reviewed version registry.
 */
export async function installSandboxSkills(
  handle: SandboxHandle,
  snapshots: readonly SkillSnapshot[]
): Promise<string[]> {
  const paths: string[] = [];
  if (!snapshots.length) {
    return paths;
  }
  const { filesystem } = handle;
  if (!filesystem) {
    throw new Error("runtime:sandbox-skills:filesystem-required");
  }
  const runDirectory = `piwork/skills/${randomUUID()}`;
  for (const snapshot of snapshots) {
    const directory = `${runDirectory}/${snapshot.skill.name}`;
    for (const file of snapshot.files) {
      await filesystem.writeAtomic({
        content: file.bytes,
        expectedSha256: null,
        maxBytes: MAX_SKILL_FILE_BYTES,
        path: `${directory}/${file.path}`,
      });
    }
    paths.push(path.posix.join(handle.workspaceRoot, directory, "SKILL.md"));
  }
  return paths;
}

export function sandboxSkillsPrompt(
  spec: RuntimeSpec,
  workspaceRoot: string
): string[] {
  // Remove only the platform-generated catalog segment, never replace arbitrary
  // user instructions/history strings. CLI adds the real sandbox catalog itself.
  const hostCatalog = buildSkillsSystemPrompt(spec.skills ?? []);
  return [
    ...spec.appendSystemPrompt
      .filter((segment) => segment !== hostCatalog)
      .map((segment) =>
        spec.workspaceDir &&
        segment.startsWith("## Workspace and execution tools\n")
          ? segment.replace(
              `- Your working directory (workspace) is: ${spec.workspaceDir}.`,
              `- Your working directory (workspace) is: ${workspaceRoot}.`
            )
          : segment
      ),
    "Skills are available through the sandbox-local SKILL.md paths advertised below. Use read to load their instructions; load_skill and create_skill host tools are not available here. Resolve scripts/references/assets relative to that skill directory, not the host. Run scripts with an existing node/python/sh interpreter. Missing dependencies must be reported; do not install packages. Your actual working directory is the sandbox workspace; write outputs there and use deliver_file for downloads.",
  ];
}
