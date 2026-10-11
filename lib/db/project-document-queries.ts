import "server-only";

import { and, eq } from "drizzle-orm";
import { MAX_PROJECT_DOCUMENTS } from "@/lib/projects/document-inputs";
import type { RuntimeSpec } from "@/lib/runtime/protocol";
import { getChatAccess } from "./chat-share-queries";
import { getDb } from "./client";
import { getProject, getProjectDocumentSources } from "./project-queries";
import { agentRun, chat, member, user } from "./schema";

/** Host callback only. Rechecks the actual run actor, chat and project membership. */
export async function loadAuthorizedProjectDocuments(spec: RuntimeSpec) {
  const grant = spec.projectSources;
  if (!grant || !spec.runId) {
    throw new Error("runtime:project-documents:missing-owned-run");
  }
  const [run] = await getDb()
    .select({ id: agentRun.id })
    .from(agentRun)
    .innerJoin(chat, eq(chat.id, agentRun.chatId))
    .innerJoin(member, eq(member.userId, agentRun.userId))
    .innerJoin(user, eq(user.id, agentRun.userId))
    .where(
      and(
        eq(agentRun.id, spec.runId),
        eq(agentRun.chatId, spec.chatId),
        eq(agentRun.userId, grant.userId),
        eq(agentRun.status, "starting"),
        eq(agentRun.backend, "sandbox_rpc"),
        eq(chat.projectId, grant.projectId),
        eq(member.status, "enabled"),
        eq(user.isAnonymous, false)
      )
    )
    .limit(1);
  const access = await getChatAccess(spec.chatId, grant.userId);
  if (
    !run ||
    !(access?.isOwner || access?.isCollaborator) ||
    !(await getProject(grant.userId, grant.projectId))
  ) {
    throw new Error("项目资料访问权限已失效，不能启动读取。");
  }
  const sources = await getProjectDocumentSources(
    grant.userId,
    grant.projectId
  );
  if (sources.length > MAX_PROJECT_DOCUMENTS) {
    throw new Error("项目资料超过 50 份，请减少资料或拆分项目。");
  }
  return sources.filter((source) => source.content.trim());
}
