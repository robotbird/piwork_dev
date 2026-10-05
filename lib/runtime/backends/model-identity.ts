import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { RuntimeModel } from "../protocol/events";

/** Only official model identity, never credentials, URLs or provider options. */
export function completedModel(
  message: Pick<AssistantMessage, "provider" | "model" | "responseModel">
): RuntimeModel | undefined {
  if (
    typeof message.provider !== "string" ||
    !message.provider ||
    typeof message.model !== "string" ||
    !message.model
  ) {
    return;
  }
  return {
    id: message.model,
    provider: message.provider,
    ...(typeof message.responseModel === "string" && message.responseModel
      ? { responseModel: message.responseModel }
      : {}),
  };
}
