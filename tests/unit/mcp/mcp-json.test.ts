import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildMcpJsonConfig,
  serializeMcpJsonConfig,
  writeMcpConfigIfChanged,
} from "../../../lib/mcp/mcp-json.ts";

function stdioServer(overrides = {}) {
  return {
    args: ["-y", "mcp-server-weather"],
    command: "npx",
    enabled: true,
    env: { API_KEY: "secret" },
    headers: {},
    name: "weather",
    transport: "stdio",
    url: null,
    ...overrides,
  };
}

test("stdio server maps to command/args/env shape", () => {
  const config = buildMcpJsonConfig([stdioServer()]);
  assert.deepEqual(config, {
    mcpServers: {
      weather: {
        args: ["-y", "mcp-server-weather"],
        command: "npx",
        env: { API_KEY: "secret" },
      },
    },
  });
});

test("http server maps to url/headers shape", () => {
  const config = buildMcpJsonConfig([
    stdioServer({
      headers: { Authorization: "Bearer token" },
      name: "remote",
      transport: "http",
      url: "https://example.com/mcp",
    }),
  ]);
  assert.deepEqual(config, {
    mcpServers: {
      remote: {
        headers: { Authorization: "Bearer token" },
        url: "https://example.com/mcp",
      },
    },
  });
});

test("disabled servers are excluded", () => {
  const config = buildMcpJsonConfig([
    stdioServer(),
    stdioServer({ enabled: false, name: "paused" }),
  ]);
  assert.deepEqual(Object.keys(config.mcpServers), ["weather"]);
});

test("empty args/env/headers keys are omitted", () => {
  const config = buildMcpJsonConfig([
    stdioServer({ args: [], env: {} }),
    stdioServer({
      args: [],
      env: {},
      name: "remote",
      transport: "http",
      url: "https://example.com/mcp",
    }),
  ]);
  assert.deepEqual(config.mcpServers.weather, { command: "npx" });
  assert.deepEqual(config.mcpServers.remote, {
    url: "https://example.com/mcp",
  });
});

test("serialization is key-sorted and stable regardless of input order", () => {
  const a = serializeMcpJsonConfig(
    buildMcpJsonConfig([stdioServer(), stdioServer({ name: "alpha" })])
  );
  const b = serializeMcpJsonConfig(
    buildMcpJsonConfig([stdioServer({ name: "alpha" }), stdioServer()])
  );
  assert.equal(a, b);
  assert.ok(a.endsWith("}\n"));
  assert.ok(a.indexOf('"alpha"') < a.indexOf('"weather"'));
});

test("writeMcpConfigIfChanged writes when file is missing, skips identical content, rewrites on change", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "piwork-mcp-"));
  const target = join(cwd, ".mcp.json");
  try {
    const first = serializeMcpJsonConfig(buildMcpJsonConfig([stdioServer()]));
    assert.equal(await writeMcpConfigIfChanged(target, first), true);
    assert.equal(await readFile(target, "utf8"), first);

    // 相同内容不写盘
    assert.equal(await writeMcpConfigIfChanged(target, first), false);

    // 内容变化后重写
    const second = serializeMcpJsonConfig(
      buildMcpJsonConfig([stdioServer(), stdioServer({ name: "alpha" })])
    );
    assert.equal(await writeMcpConfigIfChanged(target, second), true);
    assert.equal(await readFile(target, "utf8"), second);

    // 旧文件不可读（被目录占位等）时视为需要写入
    await writeFile(target, "not json", "utf8");
    assert.equal(await writeMcpConfigIfChanged(target, first), true);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
