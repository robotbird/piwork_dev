"use server";

import type { UIMessage } from "ai";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { completePiText } from "@/lib/ai/pi";
import { titlePrompt } from "@/lib/ai/prompts";
import { checkUserTokenQuota, getUserModelCatalog } from "@/lib/ai/role-access";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getMessageById,
  updateChatVisibilityById,
} from "@/lib/db/queries";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const t = await getTranslations("api");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("unauthorizedAccess"));
  }
  const catalog = await getUserModelCatalog(session.user.id);
  const modelId = catalog.defaultModelId ?? catalog.models[0]?.id;
  if (!modelId) {
    throw new Error(t("noAuthorizedModel"));
  }
  await checkUserTokenQuota(session.user.id);
  // 标题只需要消息开头；超长消息避免整篇发给标题模型（成本与时延）。
  const text = await completePiText({
    modelId,
    prompt: getTextFromMessage(message).slice(0, 2000),
    systemPrompt: titlePrompt,
  });
  return text
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .trim();
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const t = await getTranslations("api");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("unauthorizedAccess"));
  }

  const [message] = await getMessageById({ id });
  if (!message) {
    throw new Error(t("messageNotFound"));
  }

  const chat = await getChatById({ id: message.chatId });
  if (!chat || chat.userId !== session.user.id) {
    throw new Error(t("unauthorizedAccess"));
  }

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const t = await getTranslations("api");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("unauthorizedAccess"));
  }

  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== session.user.id) {
    throw new Error(t("unauthorizedAccess"));
  }

  await updateChatVisibilityById({ chatId, visibility });
}
