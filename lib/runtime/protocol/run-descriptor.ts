import { z } from "zod";

/** P0 wire contract. Only the trusted platform may construct this DTO.
 * Schema validity is NOT authorization: submission, claim and tool execution
 * must recheck ownership/current policy. No Pi objects, bytes, callbacks or keys.
 * RuntimeSpec remains the separate in-host SDK assembly contract.
 */
export const RUN_DESCRIPTOR_VERSION = 1;
export const MAX_RUN_DESCRIPTOR_BYTES = 256 * 1024;

const reference = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const positiveInteger = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const nonnegativeInteger = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

const versionedReference = z.strictObject({
  id: reference,
  sha256,
  version: reference,
});
const snapshotReference = z.strictObject({
  id: z.uuid(),
  revision: positiveInteger,
  sha256,
});

/** Logical POSIX path only. Actual containment/symlink checks belong to the
 * provider; never turn this validation into permission to access host files.
 */
export function isSafeWorkspacePath(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 1024 &&
    value === value.normalize("NFC") &&
    !/[\\:%]/.test(value) &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    }) &&
    value
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

const workspacePath = z
  .string()
  .refine(isSafeWorkspacePath, "Unsafe workspace path");
const fileReference = z.strictObject({
  libraryItemId: z.uuid(),
  sha256,
  sizeBytes: nonnegativeInteger,
});
const attachment = z.discriminatedUnion("use", [
  fileReference.extend({
    targetPath: z.null(),
    use: z.literal("vision"),
  }),
  fileReference.extend({
    targetPath: workspacePath,
    use: z.literal("workspace"),
  }),
]);

const fqdn = z
  .string()
  .max(253)
  .refine(
    (value) =>
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
        value
      ) &&
      value.split(".").every((label) => label.length <= 63) &&
      /[a-z]/.test(value.split(".").at(-1) ?? ""),
    "Expected a lowercase FQDN, not a URL, wildcard or IP address"
  );
const egress = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("deny-all") }),
  z.strictObject({
    fqdns: z.array(fqdn).min(1).max(100),
    mode: z.literal("allowlist"),
  }),
]);

const workspace = z.strictObject({
  id: z.uuid(),
  // Immutable approved image, not a mutable tag or host filesystem path.
  image: z
    .string()
    .max(500)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/:/-]*@sha256:[a-f0-9]{64}$/),
  resource: z.strictObject({
    cpuCores: z.number().positive().max(128),
    diskBytes: positiveInteger,
    maxFiles: positiveInteger,
    memoryMB: positiveInteger,
    pids: positiveInteger,
  }),
});

const executionToolNames = new Set(["bash", "read", "edit", "write"]);

export const runDescriptorSchema = z
  .strictObject({
    attachments: z.array(attachment).max(100),
    attempt: positiveInteger,
    backend: z.enum(["in_process", "sandbox_rpc", "sandbox_tools", "durable"]),
    budget: z.strictObject({
      maxCostMicros: nonnegativeInteger,
      maxModelRetries: z.number().int().min(0).max(10),
      maxRunSeconds: positiveInteger,
      maxTokens: positiveInteger,
      maxToolSeconds: positiveInteger,
    }),
    chatId: z.uuid(),
    egress,
    history: snapshotReference,
    input: snapshotReference,
    lane: z.enum(["interactive", "background", "scheduled"]),
    model: z.strictObject({ modelId: reference, providerId: reference }),
    packages: z.array(versionedReference).max(100),
    policyVersion: reference,
    prompt: versionedReference,
    runId: z.uuid(),
    schemaVersion: z.literal(RUN_DESCRIPTOR_VERSION),
    skills: z.array(versionedReference).max(100),
    tools: z
      .array(
        versionedReference.extend({
          effect: z.enum(["read_only", "workspace", "external_write"]),
        })
      )
      .max(200),
    userId: z.uuid(),
    workspace: workspace.nullable(),
  })
  .superRefine((descriptor, context) => {
    const issue = (path: string[], message: string) =>
      context.addIssue({ code: "custom", message, path });
    if (descriptor.backend === "in_process" && descriptor.workspace !== null) {
      issue(
        ["workspace"],
        "In-process descriptors cannot grant workspace execution"
      );
    }
    if (
      ["sandbox_tools", "durable"].includes(descriptor.backend) &&
      descriptor.workspace === null
    ) {
      issue(["workspace"], "This backend requires a sandbox workspace");
    }
    if (descriptor.backend === "durable" && descriptor.lane === "interactive") {
      issue(
        ["lane"],
        "Durable is restricted to explicitly selected background tasks"
      );
    }
    if (descriptor.budget.maxToolSeconds > descriptor.budget.maxRunSeconds) {
      issue(
        ["budget", "maxToolSeconds"],
        "Tool timeout exceeds the run budget"
      );
    }
    if (descriptor.workspace === null) {
      if (descriptor.attachments.some((file) => file.use === "workspace")) {
        issue(["attachments"], "Workspace hydration requires a workspace");
      }
      if (descriptor.tools.some((tool) => tool.effect === "workspace")) {
        issue(["tools"], "Workspace tools require a workspace");
      }
      if (descriptor.egress.mode !== "deny-all") {
        issue(["egress"], "No sandbox egress grant without a workspace");
      }
    }
    if (
      descriptor.tools.some(
        (tool) => executionToolNames.has(tool.id) && tool.effect !== "workspace"
      )
    ) {
      issue(
        ["tools"],
        "Reserved execution tools must declare workspace access"
      );
    }
    for (const collection of ["tools", "skills", "packages"] as const) {
      const ids = descriptor[collection].map((item) => item.id);
      if (new Set(ids).size !== ids.length) {
        issue([collection], "Duplicate resource references");
      }
    }
    const targets = descriptor.attachments.flatMap((file) =>
      file.use === "workspace" ? [file.targetPath] : []
    );
    if (new Set(targets).size !== targets.length) {
      issue(["attachments"], "Duplicate hydration targets");
    }
    if (
      descriptor.egress.mode === "allowlist" &&
      new Set(descriptor.egress.fqdns).size !== descriptor.egress.fqdns.length
    ) {
      issue(["egress"], "Duplicate egress hosts");
    }
  });

export type RunDescriptor = z.infer<typeof runDescriptorSchema>;

/** Strict validation before stringify prevents secrets/closures being silently
 * dropped. Output is a fresh schema-owned value. No implicit defaults/coercion.
 */
export function serializeRunDescriptor(input: unknown): string {
  const json = JSON.stringify(runDescriptorSchema.parse(input));
  assertDescriptorSize(json);
  return json;
}

export function parseRunDescriptor(json: string): RunDescriptor {
  assertDescriptorSize(json);
  return runDescriptorSchema.parse(JSON.parse(json));
}

function assertDescriptorSize(json: string): void {
  if (new TextEncoder().encode(json).byteLength > MAX_RUN_DESCRIPTOR_BYTES) {
    throw new Error("runtime:descriptor:too-large");
  }
}
