import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { agentRun, chat, member, user } from "./schema";

const db = drizzle(
  postgres(process.env.POSTGRES_URL ?? "", { idle_timeout: 20, max: 2 })
);

export async function isEnabledDurableChatUser(
  userId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .innerJoin(member, eq(member.userId, user.id))
    .where(
      and(
        eq(user.id, userId),
        eq(user.isAnonymous, false),
        eq(member.status, "enabled")
      )
    );
  return Boolean(row);
}

/** Recheck platform ownership/status before open, provision, hydration and each execute.
 * Lease ownership is not workspace fencing; this is still a single-host probe.
 */
export async function canExecuteDurableChatRun(
  userId: string,
  chatId: string,
  runId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: agentRun.id })
    .from(agentRun)
    .innerJoin(chat, eq(chat.id, agentRun.chatId))
    .innerJoin(user, eq(user.id, agentRun.userId))
    .innerJoin(member, eq(member.userId, user.id))
    .where(
      and(
        eq(agentRun.id, runId),
        eq(agentRun.chatId, chatId),
        eq(agentRun.userId, userId),
        eq(chat.userId, userId),
        eq(agentRun.backend, "durable_sandbox"),
        inArray(agentRun.status, ["queued", "starting", "running"]),
        eq(user.isAnonymous, false),
        eq(member.status, "enabled")
      )
    );
  return Boolean(row);
}
