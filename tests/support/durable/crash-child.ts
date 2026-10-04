import { appendFile } from "node:fs/promises";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createModels,
  fauxAssistantMessage,
  fauxToolCall,
  Type,
} from "@earendil-works/pi-ai";
import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import {
  createRegistry,
  defineExtension,
  Harness,
} from "@earendil-works/pi-durable";
import { openOwnedDurableStorage } from "../../../lib/runtime/backends/durable/storage";

const [root, mode] = process.argv.slice(2);
if (!root) {
  throw new Error("missing root");
}
const binding = {
  chatId: "00000000-0000-0000-0000-000000000002",
  inputHash: "a".repeat(64),
  runId: "00000000-0000-0000-0000-000000000003",
  userId: "00000000-0000-0000-0000-000000000001",
};
const owned = await openOwnedDurableStorage(root, binding);
if (mode === "lock") {
  process.send?.("ready");
  setInterval(() => undefined, 1000);
} else {
  const models = createModels();
  const faux = fauxProvider();
  models.setProvider(faux.provider);
  const registry = createRegistry();
  if (mode === "tool") {
    registry.install(
      defineExtension({
        name: "test-effects",
        tools: [
          {
            description: "unsafe test effect",
            execute: async () => {
              await appendFile(`${root}/effects`, "once\n");
              process.send?.("ready");
              return new Promise(() => undefined);
            },
            name: "effect",
            parameters: Type.Object({}),
            replay: "unsafe",
          },
        ],
      })
    );
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall("effect", {})], {
        stopReason: "toolUse",
      }),
    ]);
  } else {
    faux.setResponses([
      () => {
        process.send?.("ready");
        return new Promise(() => undefined);
      },
    ]);
  }
  const harness = await Harness.open(
    owned.storage,
    { models, registry },
    BACKGROUND_CONTEXT
  );
  const conversation = await harness.root(BACKGROUND_CONTEXT);
  await conversation.configure(
    {
      model: {
        modelId: faux.getModel().id,
        provider: faux.getModel().provider,
      },
    },
    BACKGROUND_CONTEXT
  );
  await conversation.submit(
    { content: "request", requestId: "stable-request", type: "input" },
    BACKGROUND_CONTEXT
  );
  setInterval(() => undefined, 1000);
}
