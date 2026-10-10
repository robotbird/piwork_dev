import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Deterministic real-container probe. No real model/API credentials. */
export default function skillProbe(pi: ExtensionAPI) {
  const faux = fauxProvider({
    models: [{ id: "probe", name: "Skill probe" }],
    provider: "piwork-skill-probe",
    tokensPerSecond: 1000,
  });
  faux.setResponses([
    (context) => {
      const user = context.messages
        .filter((message) => message.role === "user")
        .at(-1);
      const text = user
        ? typeof user.content === "string"
          ? user.content
          : user.content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n")
        : "";
      const match = text.match(
        /<skill name="sandbox-script" location="([^"]+\/SKILL\.md)">/
      );
      if (!match) {
        throw new Error("Official remote Skill expansion missing");
      }
      writeFileSync("piwork/skill-expanded.txt", text);
      const script = path.join(path.dirname(match[1]), "scripts/report.mjs");
      return fauxAssistantMessage([
        fauxToolCall("bash", {
          command: `node '${script.replaceAll("'", "'\\''")}'`,
          timeout: 10,
        }),
      ]);
    },
    fauxAssistantMessage([
      fauxToolCall("deliver_file", { path: "skill-result.txt" }),
    ]),
    fauxAssistantMessage([fauxText("Skill script completed")]),
  ]);
  pi.registerProvider(faux.provider);
}
