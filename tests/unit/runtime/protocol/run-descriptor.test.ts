import assert from "node:assert/strict";
import test from "node:test";
import {
  isSafeWorkspacePath,
  MAX_RUN_DESCRIPTOR_BYTES,
  parseRunDescriptor,
  runDescriptorSchema,
  serializeRunDescriptor,
} from "../../../../lib/runtime/protocol/run-descriptor";
import {
  descriptorHash,
  makeRunDescriptor,
  makeWorkspaceDescriptor,
} from "../../../fixtures/runtime/run-descriptor";

function rejected(input: unknown): void {
  assert.throws(() => serializeRunDescriptor(input));
}

test("descriptor: conversation round trip without Pi objects or a workspace", () => {
  const descriptor = makeRunDescriptor();
  const restored = parseRunDescriptor(serializeRunDescriptor(descriptor));
  assert.deepEqual(restored, descriptor);
  assert.notEqual(restored, descriptor);
  assert.notEqual(restored.model, descriptor.model);
});

test("descriptor: sandbox workspace and immutable attachment references round trip", () => {
  const descriptor = makeWorkspaceDescriptor();
  descriptor.attachments = [
    {
      libraryItemId: "00000000-0000-4000-8000-000000000007",
      sha256: descriptorHash,
      sizeBytes: 42,
      targetPath: "uploads/报告.xlsx",
      use: "workspace",
    },
  ];
  descriptor.egress = { fqdns: ["files.example.com"], mode: "allowlist" };
  assert.deepEqual(
    parseRunDescriptor(serializeRunDescriptor(descriptor)),
    descriptor
  );
});

test("descriptor: vision references do not require workspace hydration", () => {
  const descriptor = makeRunDescriptor();
  descriptor.attachments = [
    {
      libraryItemId: "00000000-0000-4000-8000-000000000007",
      sha256: descriptorHash,
      sizeBytes: 42,
      targetPath: null,
      use: "vision",
    },
  ];
  assert.deepEqual(
    parseRunDescriptor(serializeRunDescriptor(descriptor)),
    descriptor
  );
});

test("descriptor: reject unknown versions, enum values and missing fields without defaults", () => {
  rejected({ ...makeRunDescriptor(), schemaVersion: 2 });
  rejected({ ...makeRunDescriptor(), backend: "future_backend" });
  const { policyVersion: _omitted, ...missing } = makeRunDescriptor();
  rejected(missing);
  rejected({ ...makeRunDescriptor(), attempt: "1" });
  assert.throws(() => parseRunDescriptor("not-json"));
});

test("descriptor: reject credentials, SDK objects, callbacks and raw bytes at every level", () => {
  rejected({ ...makeRunDescriptor(), apiKey: "secret" });
  rejected({ ...makeRunDescriptor(), tools: [{ execute: () => undefined }] });
  rejected({
    ...makeRunDescriptor(),
    model: { ...makeRunDescriptor().model, apiKey: "secret" },
  });
  const descriptor = makeWorkspaceDescriptor();
  descriptor.attachments = [
    {
      libraryItemId: "00000000-0000-4000-8000-000000000007",
      sha256: descriptorHash,
      sizeBytes: 1,
      targetPath: "uploads/a.txt",
      use: "workspace",
    },
  ];
  rejected({
    ...descriptor,
    attachments: [{ ...descriptor.attachments[0], bytes: new Uint8Array([1]) }],
  });
  rejected({
    ...descriptor,
    workspace: { ...descriptor.workspace, hostPath: "/etc" },
  });
  rejected({
    ...makeRunDescriptor(),
    input: { ...makeRunDescriptor().input, content: "inline history" },
  });
});

test("descriptor: enforce backend/lane/workspace consistency while preserving RPC all mode", () => {
  rejected({ ...makeWorkspaceDescriptor(), backend: "in_process" });
  rejected({ ...makeRunDescriptor(), backend: "sandbox_tools" });
  rejected({ ...makeWorkspaceDescriptor(), backend: "durable" });
  for (const lane of ["background", "scheduled"] as const) {
    assert.equal(
      runDescriptorSchema.parse({
        ...makeWorkspaceDescriptor(),
        backend: "durable",
        lane,
      }).lane,
      lane
    );
  }
  // Existing all routing can send a pure conversation to RPC with no workspace.
  assert.equal(
    runDescriptorSchema.parse({
      ...makeRunDescriptor(),
      backend: "sandbox_rpc",
    }).workspace,
    null
  );
});

test("descriptor: reserved execution tools cannot pretend to be read-only or run on host", () => {
  for (const id of ["bash", "read", "edit", "write"]) {
    rejected({
      ...makeWorkspaceDescriptor(),
      tools: [
        { effect: "read_only", id, sha256: descriptorHash, version: "1" },
      ],
    });
    rejected({
      ...makeRunDescriptor(),
      tools: [
        { effect: "workspace", id, sha256: descriptorHash, version: "1" },
      ],
    });
  }
});

test("descriptor: budgets and hashes must be explicit, finite and bounded", () => {
  const base = makeRunDescriptor();
  for (const attempt of [0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
    rejected({ ...base, attempt });
  }
  rejected({
    ...base,
    budget: { ...base.budget, maxToolSeconds: base.budget.maxRunSeconds + 1 },
  });
  rejected({
    ...base,
    budget: { ...base.budget, maxTokens: Number.MAX_SAFE_INTEGER + 1 },
  });
  rejected({ ...base, input: { ...base.input, sha256: "invalid" } });
  rejected({
    ...makeWorkspaceDescriptor(),
    workspace: {
      ...makeWorkspaceDescriptor().workspace,
      image: "office:latest",
    },
  });
});

test("descriptor: reject ambiguous or escaping hydration paths", () => {
  for (const value of [
    "",
    "/workspace/a",
    "../a",
    "a/../b",
    "a/./b",
    "a//b",
    "a/",
    "C:\\a",
    "a\\b",
    "a%2fb",
    "a\u0000b",
    "a\nb",
    "https://host/a",
    "e\u0301.txt",
  ]) {
    assert.equal(isSafeWorkspacePath(value), false, value);
  }
  for (const value of [
    "uploads/report.xlsx",
    "uploads/报告.pdf",
    "progress/state.md",
  ]) {
    assert.equal(isSafeWorkspacePath(value), true, value);
  }
  const file = {
    libraryItemId: "00000000-0000-4000-8000-000000000007",
    sha256: descriptorHash,
    sizeBytes: 1,
    targetPath: "../a",
    use: "workspace",
  };
  rejected({ ...makeWorkspaceDescriptor(), attachments: [file] });
  rejected({
    ...makeRunDescriptor(),
    attachments: [{ ...file, targetPath: "uploads/a" }],
  });
});

test("descriptor: reject duplicate tool/artifact/egress references", () => {
  const descriptor = makeWorkspaceDescriptor();
  rejected({
    ...descriptor,
    tools: [...descriptor.tools, ...descriptor.tools],
  });
  const item = { id: "office", sha256: descriptorHash, version: "1" };
  for (const collection of ["skills", "packages"]) {
    rejected({ ...descriptor, [collection]: [item, item] });
  }
  const file = {
    libraryItemId: "00000000-0000-4000-8000-000000000007",
    sha256: descriptorHash,
    sizeBytes: 1,
    targetPath: "uploads/a",
    use: "workspace",
  };
  rejected({ ...descriptor, attachments: [file, file] });
  rejected({
    ...descriptor,
    egress: { fqdns: ["example.com", "example.com"], mode: "allowlist" },
  });
});

test("descriptor: FQDN requests are not IP/URL/wildcard grants", () => {
  for (const host of [
    "127.0.0.1",
    "::1",
    "*.example.com",
    "https://example.com",
    "example.com:443",
    "localhost",
    "Example.com",
    "-bad.example.com",
  ]) {
    rejected({
      ...makeWorkspaceDescriptor(),
      egress: { fqdns: [host], mode: "allowlist" },
    });
  }
  rejected({
    ...makeRunDescriptor(),
    egress: { fqdns: ["example.com"], mode: "allowlist" },
  });
});

test("descriptor: bound the complete wire payload before JSON parsing", () => {
  assert.throws(
    () => parseRunDescriptor(" ".repeat(MAX_RUN_DESCRIPTOR_BYTES + 1)),
    /too-large/
  );
  assert.throws(
    () => parseRunDescriptor("中".repeat(MAX_RUN_DESCRIPTOR_BYTES / 2)),
    /too-large/
  );
  const item = {
    id: "a".repeat(200),
    sha256: descriptorHash,
    version: "b".repeat(200),
  };
  const descriptor = makeWorkspaceDescriptor();
  const items = Array.from({ length: 100 }, (_, index) => ({
    ...item,
    id: `${index}${item.id.slice(3)}`,
  }));
  const tools = Array.from({ length: 200 }, (_, index) => ({
    ...item,
    effect: "read_only",
    id: `${index}${item.id.slice(3)}`,
  }));
  const attachments = Array.from({ length: 100 }, (_, index) => ({
    libraryItemId: "00000000-0000-4000-8000-000000000007",
    sha256: descriptorHash,
    sizeBytes: 1,
    targetPath: `uploads/${index}/${"a".repeat(1000)}`,
    use: "workspace" as const,
  }));
  const oversized = {
    ...descriptor,
    attachments,
    packages: items,
    skills: items,
    tools,
  };
  // Each field is valid: rejection must come from the aggregate byte limit.
  assert.ok(runDescriptorSchema.safeParse(oversized).success);
  assert.throws(() => serializeRunDescriptor(oversized), /too-large/);
});
