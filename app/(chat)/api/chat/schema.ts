import { z } from "zod";
import {
  getChatFileId,
  isSupportedAttachmentMediaType,
} from "@/lib/ai/attachment-types";
import { CHAT_TEXT_PART_MAX_LENGTH } from "@/lib/chat-input";

const textPartSchema = z.object({
  text: z.string().min(1).max(CHAT_TEXT_PART_MAX_LENGTH),
  type: z.enum(["text"]),
});

// 附件 URL：Vercel Blob 为 https 绝对地址，本地存储为 /api/files/:id 相对路径。
const fileUrlSchema = z.union([
  z.url(),
  z.string().refine((url) => getChatFileId(url) !== null, {
    message: "Invalid attachment URL",
  }),
]);

const filePartSchema = z.object({
  filename: z.string().min(1).max(255),
  mediaType: z.string().refine(isSupportedAttachmentMediaType),
  type: z.enum(["file"]),
  url: fileUrlSchema,
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const userMessageSchema = z.object({
  id: z.uuid(),
  parts: z.array(partSchema).min(1).max(6),
  role: z.enum(["user"]),
});

const toolApprovalMessageSchema = z.object({
  id: z.string(),
  parts: z.array(z.record(z.string(), z.unknown())),
  role: z.enum(["user", "assistant"]),
});

// Backend selection and grants are server-owned. Unknown client fields (including
// legacy runtimeLane) are stripped, never used to force or bypass automatic routing.
export const postRequestBodySchema = z.object({
  id: z.uuid(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;

// 判定请求体验证失败是否由「用户消息文本超过长度上限」引起，
// 用于返回专属错误码 bad_request:chat（含具体上限文案），
// 而不是通用 bad_request:api 提示。
export function isMessageTextTooLongError(error: unknown): boolean {
  if (!(error instanceof z.ZodError)) {
    return false;
  }
  return error.issues.some(
    (issue) =>
      issue.code === "too_big" &&
      issue.path.at(-1) === "text" &&
      issue.path[0] === "message"
  );
}
