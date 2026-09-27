import { readFileSync } from "node:fs";
import {
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxProvider,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { chatModels } from "../../lib/ai/models";

/**
 * 子进程侧 faux provider 扩展（LocalRpc 契约测试专用，v2.0 Step 3 §3.5）。
 *
 * 本文件只被 `pi --mode rpc` 子进程按路径加载（-e），父进程代码永不 import。
 * faux provider 纯程序化、无 CLI/env 开关，进子进程的唯一通道就是扩展里
 * pi.registerProvider——官方 custom-provider 文档即此形态（从本包的
 * @earendil-works/pi-ai 构造完整 Provider 注册）。
 *
 * 响应脚本经 PIWORK_FAUX_SCRIPT 传 JSON 文件（FauxResponseStep 的纯对象
 * 分支，fauxAssistantMessage(...) 产物；函数分支不可序列化，序列化时自然
 * 丢弃）。未提供脚本时退回关键字分发（同 lib/ai/pi.ts 测试默认），供手工
 * 冒烟零准备起步。模型清单镜像 lib/ai/models 测试目录，provider id 与
 * lib/ai/pi.ts 注册一致（"deepseek"），--provider/--model 才能解析到 faux。
 */
export default function fauxProviderExtension(pi: ExtensionAPI): void {
  const faux = fauxProvider({
    models: chatModels.map((model) => ({
      id: model.id.split("/")[1] ?? model.id,
      name: model.name,
      reasoning: true,
    })),
    provider: "deepseek",
    tokensPerSecond: 100,
  });

  const scriptPath = process.env.PIWORK_FAUX_SCRIPT;
  if (scriptPath) {
    faux.setResponses(
      JSON.parse(readFileSync(scriptPath, "utf8")) as FauxResponseStep[]
    );
  } else {
    faux.setResponses(
      Array.from({ length: 200 }, () => (context) => {
        const prompt =
          context.messages
            .filter((message) => message.role === "user")
            .map((message) =>
              typeof message.content === "string"
                ? message.content
                : message.content
                    .filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join(" ")
            )
            // 只按最后一条 user 消息分发（同 lib/ai/pi.ts：全史拼会让历史关键字抢占）
            .at(-1)
            ?.toLowerCase() ?? "";
        return fauxAssistantMessage(
          prompt.includes("hello") || prompt.includes("hi")
            ? "Hello! How can I help you today?"
            : "This is a mock response for testing."
        );
      })
    );
  }

  pi.registerProvider(faux.provider);
}
