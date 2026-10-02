import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildMcpJsonConfig,
  parseMcpConfigString,
  serializeMcpJsonConfig,
  writeMcpConfigIfChanged,
} from "../../../lib/mcp/mcp-json.ts";

function stdioServer(overrides = {}) {
  return {
    args: ["-y", "mcp-server-weather"],
    command: "npx",
    description: "",
    enabled: true,
    env: { API_KEY: "secret" },
    headers: {},
    name: "weather",
    transport: "stdio",
    url: null,
    ...overrides,
  };
}

test("stdio server maps to command/args/env with direct exposure", () => {
  const config = buildMcpJsonConfig([stdioServer()]);
  assert.deepEqual(config, {
    mcpServers: {
      weather: {
        args: ["-y", "mcp-server-weather"],
        command: "npx",
        env: { API_KEY: "secret" },
        exposure: "direct",
      },
    },
  });
});

test("http server maps to url/headers with direct exposure", () => {
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
        exposure: "direct",
        headers: { Authorization: "Bearer token" },
        url: "https://example.com/mcp",
      },
    },
  });
});

test("non-empty description is carried through", () => {
  const config = buildMcpJsonConfig([
    stdioServer({ description: "Weather lookups" }),
  ]);
  assert.equal(config.mcpServers.weather.description, "Weather lookups");
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
      description: "",
      env: {},
      name: "remote",
      transport: "http",
      url: "https://example.com/mcp",
    }),
  ]);
  assert.deepEqual(config.mcpServers.weather, {
    command: "npx",
    exposure: "direct",
  });
  assert.deepEqual(config.mcpServers.remote, {
    exposure: "direct",
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
  const target = join(cwd, "mcp.json");
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

test("parseMcpConfigString accepts the writer's output and reports clean result", () => {
  const serialized = serializeMcpJsonConfig(
    buildMcpJsonConfig([
      stdioServer({ name: "test-stdio" }),
      stdioServer({
        name: "test-http",
        transport: "http",
        url: "https://example.com/mcp",
      }),
    ])
  );
  const result = parseMcpConfigString("/agent/mcp.json", serialized);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.servers.map((server) => server.name),
    ["test-http", "test-stdio"]
  );
  assert.equal(result.servers[0].config.url, "https://example.com/mcp");
  assert.equal(result.servers[0].config.exposure, "direct");
});

test("parseMcpConfigString collects malformed JSON, bad shapes and namespace clashes", () => {
  const broken = parseMcpConfigString("/agent/mcp.json", "{oops");
  assert.equal(broken.servers.length, 0);
  assert.equal(broken.errors.length, 1);

  const notObject = parseMcpConfigString("/agent/mcp.json", "[]");
  assert.equal(notObject.errors.length, 1);

  const missingTarget = parseMcpConfigString(
    "/agent/mcp.json",
    JSON.stringify({
      mcpServers: {
        a: { args: ["x"] },
        b_1: { command: "node" },
        "b-1": { command: "node" },
        c: 3,
      },
    })
  );
  assert.deepEqual(
    missingTarget.servers.map((server) => server.name),
    ["b_1"]
  );
  assert.equal(missingTarget.errors.length, 3);
});
