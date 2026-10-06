import "server-only";
import { authorizeRoleRun } from "../ai/role-access";
import { createWebSearchTool } from "../ai/web-tools";
import { getChatById } from "../db/queries";
import { createSearchGateway } from "./service";

/** Bind formal host identity and chat/model ownership to every tool execution. */
export function chatWebSearchTools(input: {
  userId: string;
  chatId: string;
  model: { provider: string; id: string };
}) {
  const search = createSearchGateway({
    authorize: async () => {
      try {
        const chat = await getChatById({ id: input.chatId });
        if (!chat || chat.userId !== input.userId) {
          throw new Error("ownership");
        }
        await authorizeRoleRun(input.userId, input.model);
      } catch {
        // biome-ignore lint/style/useErrorCause: Do not expose database/configuration errors to model tool results.
        throw new Error(
          "联网搜索授权失败：请确认账户、聊天归属和模型权限仍然有效。"
        );
      }
    },
    userId: input.userId,
  });
  return [createWebSearchTool(search)];
}
