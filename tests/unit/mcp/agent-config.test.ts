import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  loadPiworkMcpConfig,
  MANAGED_MCP_CONFIG_PATH,
} from "../../../lib/mcp/agent-config.ts";
import {
  buildMcpJsonConfig,
  serializeMcpJsonConfig,
} from "../../../lib/mcp/mcp-json.ts";
import { MANAGED_AGENT_DIR } from "../../../lib/pi-packages/agent-dir.ts";

function server(overrides = {}) {
  return {
    args: ["-y", "mcp-server-weather"],
    command: "npx",
    description: "Weather lookups",
    enabled: true,
    env: {},
    headers: {},
    name: "weather",
    transport: "stdio",
    url: null,
    ...overrides,
  };
}

test("MANAGED_MCP_CONFIG_PATH points into the managed agentDir", () => {
  assert.equal(MANAGED_MCP_CONFIG_PATH, resolve(MANAGED_AGENT_DIR, "mcp.json"));
});

test("missing config file loads as empty config without errors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "piwork-agent-mcp-"));
  try {
    const loaded = loadPiworkMcpConfig(join(dir, "mcp.json"));
    assert.deepEqual(loaded, { errors: [], servers: [] });
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test("valid config loads with global scope and file source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "piwork-agent-mcp-"));
  const target = join(dir, "mcp.json");
  try {
    await writeFile(
      target,
      serializeMcpJsonConfig(buildMcpJsonConfig([server()]))
    );
    const loaded = loadPiworkMcpConfig(target);
    assert.deepEqual(loaded.errors, []);
    assert.deepEqual(loaded.servers, [
      {
        config: {
          args: ["-y", "mcp-server-weather"],
          command: "npx",
          description: "Weather lookups",
          exposure: "direct",
        },
        name: "weather",
        scope: "global",
        source: target,
      },
    ]);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});

test("malformed config surfaces errors instead of throwing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "piwork-agent-mcp-"));
  const target = join(dir, "mcp.json");
  try {
    await writeFile(target, "{oops", "utf8");
    const loaded = loadPiworkMcpConfig(target);
    assert.deepEqual(loaded.servers, []);
    assert.equal(loaded.errors.length, 1);
    assert.ok(loaded.errors[0].startsWith(target));
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
});
