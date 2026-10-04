import "../../support/runtime-env";
import assert from "node:assert/strict";
import test from "node:test";
import { createPiworkAgentSession } from "../../../lib/ai/agent-session";
import { getPiModel } from "../../../lib/ai/pi";
import { MANAGED_AGENT_DIR } from "../../../lib/pi-packages/agent-dir";

test("sandbox session: SDK prompt/tool image normalization cannot enable host resizing", async (t) => {
  const agent = await createPiworkAgentSession({
    appendSystemPrompt: [],
    cwd: MANAGED_AGENT_DIR,
    disableBuiltinTools: true,
    disableImageAutoResize: true,
    historyMessages: [],
    model: await getPiModel("deepseek/deepseek-flash"),
    systemPrompt: "isolation test",
    tools: [],
  });
  t.after(() => agent.dispose());
  assert.equal(agent.session.settingsManager.getImageAutoResize(), false);
  assert.deepEqual(agent.session.getActiveToolNames(), []);
});
