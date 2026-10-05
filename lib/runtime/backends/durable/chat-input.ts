import { createHash } from "node:crypto";
import type { RuntimeCommand, RuntimeSpec } from "../../protocol";
import type { DurableChatConfig } from "./chat-policy";

export function sha256(content: Uint8Array | string): string {
  return createHash("sha256").update(content).digest("hex");
}
export function hashDurablePrompt(
  prompt: Extract<RuntimeCommand, { type: "prompt" }>
): string {
  return sha256(
    JSON.stringify({
      expandPromptTemplates: prompt.expandPromptTemplates ?? false,
      images: prompt.images ?? [],
      text: prompt.text,
    })
  );
}
export function hashDurableChatInput(
  spec: RuntimeSpec,
  config: DurableChatConfig
): string {
  return sha256(
    JSON.stringify({
      appendSystemPrompt: spec.appendSystemPrompt,
      chatId: spec.chatId,
      egress: "deny-all",
      grant: spec.durableChat,
      historyMessages: spec.historyMessages,
      image: config.image,
      model: spec.model,
      provider: config.provider,
      resource: { cpuCores: 1, memoryMB: 512 },
      systemPrompt: spec.systemPrompt,
      tools: ["read", "write", "edit", "bash", "deliver_file"],
      ttlSeconds: 600,
      version: "durable-chat-v1/pi-1.0.2",
      workspace: "ephemeral",
    })
  );
}
