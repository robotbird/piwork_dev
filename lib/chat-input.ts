// 单条聊天文本消息的字符上限。
// 允许粘贴整篇长文（早期实现为 2000 字符，粘贴长文会被直接 400 拒绝）。
// 下游各自截断：执行分类器取前 8000 字符，标题生成取前 2000 字符。
export const CHAT_TEXT_PART_MAX_LENGTH = 50_000;

// 输入文本超过该长度时，聊天输入框会把它转为 .txt 附件发送
// （粘贴与提交两条路径），文本框里保留的短文本不受影响。
export const CHAT_TEXT_TO_FILE_THRESHOLD = 2_000;

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
