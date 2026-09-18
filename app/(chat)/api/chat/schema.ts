import { z } from "zod";
import {
  getChatFileId,
  isSupportedAttachmentMediaType,
} from "@/lib/ai/attachment-types";

const textPartSchema = z.object({
  text: z.string().min(1).max(2000),
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

export const postRequestBodySchema = z.object({
  id: z.uuid(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
