import { classifyIntent } from "pi-auto-router/src/intent-classifier.ts";
import { isLightweightWebRequest } from "../search/intent";

// pi-auto-router classifies model intent, not execution permission. These
// platform rules cover Chinese tasks and capabilities its English rules miss.
const EXECUTION =
  /运行|执行|调试|部署|安装|修改.{0,12}(文件|代码)|读取.{0,12}(文件|目录)|生成.{0,12}(文件|附件|ppt|excel|pdf|word)|下载|脚本|终端|命令|工作区|浏览器|搜索|检索|联网|调用|mcp|skill|技能|\b(run|execute|install|deploy|download|browse|search|fetch|shell|terminal|script|filesystem|workspace|mcp|skill)\b|\b(create|generate|save|write|edit|read|open)\b.{0,40}\b(file|folder|directory|pdf|pptx?|xlsx?|docx?|csv)\b|\.(pdf|pptx?|xlsx?|docx?|csv)\b/i;
const GREETING =
  /^(你好|您好|嗨|哈喽|谢谢|感谢|再见|hello|hi|hey|thanks|thank you)[！!。，,.？?\s]*$/i;

export function heuristicExecution(input: {
  message: string;
  history: Array<{ role: string; text: string }>;
  attachmentCount: number;
  platformWebSearch?: boolean;
}) {
  if (input.platformWebSearch && isLightweightWebRequest(input)) {
    return {
      intent: "web",
      reason: "heuristic" as const,
      requiresExecution: false,
    };
  }
  const message = input.message.trim();
  const history = input.history
    .slice(-2)
    .map(({ role, text }) => ({ content: text.slice(0, 1500), role }));
  const intent = classifyIntent(message.slice(0, 8000), history);
  // Attachments can require raw bytes; the heuristic cannot inspect them.
  const requiresExecution =
    input.attachmentCount > 0 ||
    (!GREETING.test(message) &&
      (!message ||
        EXECUTION.test(message) ||
        intent.category === "code" ||
        history.some(({ content }) => EXECUTION.test(content))));
  return {
    intent: intent.category,
    reason: "heuristic" as const,
    requiresExecution,
  };
}
