import "../../support/runtime-env";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";
import {
  DEFAULT_SANDBOX_RESOURCE,
  LIGHT_SANDBOX_RESOURCE,
  sandboxResourceSchema,
} from "../../../lib/runtime/sandbox/resource-policy";

test("sandbox resource policy validates ranges, increments and rejects unknown fields", () => {
  for (const valid of [
    DEFAULT_SANDBOX_RESOURCE,
    LIGHT_SANDBOX_RESOURCE,
    { cpuCores: 0.25, memoryMB: 512 },
    { cpuCores: 32, memoryMB: 32_768 },
  ]) {
    assert.deepEqual(sandboxResourceSchema.parse(valid), valid);
  }
  for (const invalid of [
    { cpuCores: 0, memoryMB: 768 },
    { cpuCores: 0.3, memoryMB: 768 },
    { cpuCores: 33, memoryMB: 768 },
    { cpuCores: 1, memoryMB: 256 },
    { cpuCores: 1, memoryMB: 769 },
    { cpuCores: 1, memoryMB: 32_896 },
    { cpuCores: "1", memoryMB: 768 },
    { cpuCores: Number.NaN, memoryMB: 768 },
    { cpuCores: 1, memoryMB: 768, userId: "forged" },
    null,
  ]) {
    assert.equal(sandboxResourceSchema.safeParse(invalid).success, false);
  }
});

test("settings HTTP boundary denies before DB, validates full replacement, returns no-store and safe errors", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "sandbox-settings-route-"));
  const state = {
    actor: "",
    admin: false,
    fail: false,
    policy: DEFAULT_SANDBOX_RESOURCE,
    reads: 0,
    writes: 0,
  };
  const scope = globalThis as typeof globalThis & {
    sandboxSettingsTestState?: typeof state;
  };
  scope.sandboxSettingsTestState = state;
  try {
    const outfile = path.join(dir, "route.mjs");
    await build({
      bundle: true,
      entryPoints: ["app/(admin)/api/admin/sandbox-settings/route.ts"],
      format: "esm",
      outfile,
      platform: "node",
      plugins: [
        {
          name: "trusted-services-fixture",
          setup(builder) {
            builder.onResolve(
              {
                filter:
                  /^@\/lib\/(admin\/(access|sandbox-settings)|db\/sandbox-settings-queries|errors)$/,
              },
              (args) => ({ namespace: "fixture", path: args.path })
            );
            builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => {
              const preamble =
                "const state = globalThis.sandboxSettingsTestState;";
              let contents = "";
              if (args.path.endsWith("/access")) {
                contents =
                  "export async function requireAdminRole() { return state.admin ? {userId:'trusted-admin'} : null; }";
              } else if (args.path.endsWith("/errors")) {
                contents =
                  "export class ChatbotError { toResponse(){return Response.json({error:'unauthorized'}, {status:401});} }";
              } else if (args.path.includes("/db/")) {
                contents =
                  "export async function saveSandboxResourcePolicy(input,userId) {state.writes++; if(state.fail) throw Error('credential-secret'); state.policy=input; state.actor=userId; return input;}";
              } else {
                contents =
                  "export async function getSandboxSettingsView(){state.reads++; if(state.fail) throw Error('credential-secret'); return {resource:state.policy,provider:null,routing:'matrix',inferenceConfigured:false};}";
              }
              return { contents: preamble + contents, loader: "js" };
            });
          },
        },
      ],
    });
    const { GET, PATCH } = await import(outfile);
    const patch = (body: string) =>
      PATCH(
        new Request("http://localhost/api/admin/sandbox-settings", {
          body,
          method: "PATCH",
        })
      );
    assert.equal((await GET()).status, 401);
    assert.equal(
      (await patch(JSON.stringify(LIGHT_SANDBOX_RESOURCE))).status,
      401
    );
    assert.equal(state.reads + state.writes, 0);
    state.admin = true;
    assert.equal((await patch("{")).status, 400);
    assert.equal((await patch('{"cpuCores":1}')).status, 400);
    assert.equal(
      (await patch('{"cpuCores":1,"memoryMB":768,"userId":"fake"}')).status,
      400
    );
    assert.equal(state.writes, 0);
    const response = await patch(JSON.stringify(LIGHT_SANDBOX_RESOURCE));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(state.actor, "trusted-admin");
    assert.deepEqual((await response.json()).resource, LIGHT_SANDBOX_RESOURCE);
    assert.deepEqual(
      (await (await GET()).json()).resource,
      LIGHT_SANDBOX_RESOURCE
    );
    state.fail = true;
    const failures = await Promise.all([
      GET(),
      patch(JSON.stringify(DEFAULT_SANDBOX_RESOURCE)),
    ]);
    await Promise.all(
      failures.map(async (failure) => {
        assert.equal(failure.status, 503);
        assert.equal(
          (await failure.text()).includes("credential-secret"),
          false
        );
      })
    );
  } finally {
    scope.sandboxSettingsTestState = undefined;
    await rm(dir, { force: true, recursive: true });
  }
});
