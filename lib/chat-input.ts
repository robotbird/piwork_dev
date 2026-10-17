import { MAX_CHAT_ATTACHMENT_COUNT } from "@/lib/ai/attachment-types";

// 单条聊天文本消息的字符上限。
// 允许粘贴整篇长文（早期实现为 2000 字符，粘贴长文会被直接 400 拒绝）。
// 下游各自截断：执行分类器取前 8000 字符，标题生成取前 2000 字符。
export const CHAT_TEXT_PART_MAX_LENGTH = 50_000;

// 输入文本超过该长度时，聊天输入框会把它转为 .txt 附件发送
// （粘贴与提交两条路径），文本框里保留的短文本不受影响。
export const CHAT_TEXT_TO_FILE_THRESHOLD = 2000;

// 归一化粘贴文本的换行：Windows 剪贴板常见 \r\n、旧 Mac 为孤 \r，
// 统一成 \n，保证 txt 文件预览与模型读取时换行正确显示。
export function normalizePastedText(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

// 粘贴长文转附件时的文件名（秒级时间戳避免同次会话内重名）。
export function buildPastedTextFilename(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `pasted-text-${stamp}.txt`;
}

// 定时任务等外部入口把已上传附件带入新对话的 sessionStorage 交接：
// 字节已在原页面上传（/api/files/upload 或文档库解析），这里只传元数据；
// 消费方（use-active-chat 的 ?query= 首条消息）读取后立即清除，
// 未消费的条目随会话结束失效；项目 ?query= 入口不消费，附件不会静默进入项目对话。
export const NEW_CHAT_ATTACHMENTS_HANDOFF_KEY = "piwork:new-chat-attachments";

export type NewChatAttachmentHandoff = {
  contentType: string;
  name: string;
  url: string;
};

/** 暂存失败返回 false，调用方必须中止导航，不得静默丢失附件。 */
export function stashNewChatAttachments(
  attachments: NewChatAttachmentHandoff[]
): boolean {
  if (attachments.length === 0) {
    return true;
  }
  try {
    sessionStorage.setItem(
      NEW_CHAT_ATTACHMENTS_HANDOFF_KEY,
      JSON.stringify(attachments)
    );
    return true;
  } catch {
    return false;
  }
}

/** 读取并清除交接；逐条严格校验，非法条目丢弃，最多带一份聊天附件上限。 */
export function takeNewChatAttachments(): NewChatAttachmentHandoff[] {
  try {
    const raw = sessionStorage.getItem(NEW_CHAT_ATTACHMENTS_HANDOFF_KEY);
    if (!raw) {
      return [];
    }
    sessionStorage.removeItem(NEW_CHAT_ATTACHMENTS_HANDOFF_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const valid: NewChatAttachmentHandoff[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) {
        continue;
      }
      const { contentType, name, url } = item as Record<string, unknown>;
      if (
        typeof contentType !== "string" ||
        typeof name !== "string" ||
        typeof url !== "string" ||
        !url.startsWith("/")
      ) {
        continue;
      }
      valid.push({ contentType, name, url });
    }
    return valid.slice(0, MAX_CHAT_ATTACHMENT_COUNT);
  } catch {
    return [];
  }
}
