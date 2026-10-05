import { z } from "zod";
import type { RuntimeUsage } from "@/lib/runtime/protocol/events";

export const conversationFilters = z.object({
  days: z.enum(["all", "7", "30", "90"]).default("7"),
  model: z.string().min(1).max(512).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce
    .number()
    .pipe(z.union([z.literal(10), z.literal(20), z.literal(50)]))
    .default(10),
  project: z
    .union([z.literal("all"), z.literal("none"), z.uuid()])
    .default("all"),
  query: z.string().trim().max(200).default(""),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: z
    .enum([
      "all",
      "none",
      "queued",
      "starting",
      "running",
      "waiting_user",
      "settled",
      "failed",
      "aborted",
    ])
    .default("all"),
});
export type ConversationFilters = z.infer<typeof conversationFilters>;
export type ConversationModel = {
  key: string;
  provider: string;
  /** Display metadata only; never used to infer historical model identity. */
  providerName: string | null;
  providerKey: string | null;
  id: string;
  name: string;
  source: "response" | "request" | "audit";
};
export type ConversationRecord = {
  models: ConversationModel[];
  usage: RuntimeUsage | null;
  usageRecordedMessages: number;
  completedMessages: number;
  unrecordedRuns: number;
  id: string;
  title: string;
  userEmail: string;
  userName: string | null;
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status: Exclude<ConversationFilters["status"], "all">;
};
export type ConversationList = {
  items: ConversationRecord[];
  total: number;
  page: number;
  pageSize: number;
  projects: { id: string; name: string; userEmail: string }[];
  models: Pick<
    ConversationModel,
    "key" | "name" | "provider" | "providerName" | "providerKey" | "id"
  >[];
};
export type ConversationMessage = {
  id: string;
  role: string;
  createdAt: string;
  text: string;
};
export type ConversationDetail = {
  record: ConversationRecord;
  messages: ConversationMessage[];
  total: number;
  page: number;
};

/** Only public-facing text parts: never expose reasoning, tool arguments or raw results. */
export function conversationText(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .flatMap((part) =>
      part &&
      typeof part === "object" &&
      part.type === "text" &&
      typeof part.text === "string"
        ? [part.text]
        : []
    )
    .join("\n");
}
