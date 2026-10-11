import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Test-only: real remote read calls, paths taken from returned manifests. */
export default function documentFaux(pi: ExtensionAPI) {
  const faux = fauxProvider({
    models: [{ id: "deepseek-flash", name: "Document test" }],
    provider: "deepseek",
    tokensPerSecond: 1000,
  });
  faux.setResponses([
    (context) => {
      const system = context.messages
        .filter((message) => message.role === "system")
        .flatMap((message) => [
          typeof message.content === "string"
            ? message.content
            : message.content.map((part) => part.text).join("\n"),
          ...Object.values(message.sections ?? {}),
        ])
        .join("\n");
      const manifest = system.match(/首先用 read 读取 manifest：(.+?)。/)?.[1];
      if (!manifest) {
        throw new Error("missing sandbox manifest path");
      }
      return fauxAssistantMessage([fauxToolCall("read", { path: manifest })]);
    },
    (context) => {
      const result = context.messages.findLast(
        (message) => message.role === "toolResult"
      );
      if (result?.role !== "toolResult") {
        throw new Error("missing manifest result");
      }
      const text = result.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("");
      const manifest = JSON.parse(text);
      return fauxAssistantMessage([
        fauxToolCall("read", { path: manifest.sources[0].indexPath }),
      ]);
    },
    (context) => {
      const result = context.messages.findLast(
        (message) => message.role === "toolResult"
      );
      if (result?.role !== "toolResult") {
        throw new Error("missing index result");
      }
      const index = JSON.parse(
        result.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("")
      );
      return fauxAssistantMessage([
        fauxToolCall("read", {
          limit: 20,
          offset: 1,
          path: index.segments.at(-1).path,
        }),
      ]);
    },
    (context) => {
      const result = context.messages.findLast(
        (message) => message.role === "toolResult"
      );
      if (result?.role !== "toolResult") {
        throw new Error("missing tail result");
      }
      const text = result.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("");
      if (!text.includes("场景42：末尾证据")) {
        throw new Error("did not read beyond preview/storage cutoffs");
      }
      return fauxAssistantMessage([fauxText("已读取场景42：末尾证据")]);
    },
  ]);
  pi.registerProvider(faux.provider);
}
