import "server-only";
import { resolveRoleModelAccess } from "../admin/role-model-policy";
import { tokenLimitExceeded } from "../admin/role-token-policy";
import {
  getRoleTokenUsage,
  getUserRolePolicies,
} from "../db/role-policy-queries";
import { ChatbotError } from "../errors";
import { getActiveModelCatalog } from "./active-models";

export async function getUserModelCatalog(userId: string) {
  const [catalog, roles] = await Promise.all([
    getActiveModelCatalog(),
    getUserRolePolicies(userId),
  ]);
  const access = resolveRoleModelAccess(
    roles.flatMap((role) => (role.modelPolicy ? [role.modelPolicy] : [])),
    catalog.models.map((model) => model.id),
    catalog.defaultModelId
  );
  return {
    ...catalog,
    allowSwitch: access.allowSwitch,
    defaultModelId: access.defaultModelId,
    models: catalog.models.filter((model) =>
      access.modelIds.includes(model.id)
    ),
    platformModelCount: catalog.models.length,
  };
}
export async function checkUserTokenQuota(userId: string, runId?: string) {
  const roles = await getUserRolePolicies(userId);
  for (const role of roles) {
    if (!role.tokenPolicy) {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: Bound DB work sequentially and stop at the first blocking policy.
    const usage = await getRoleTokenUsage(role.id, runId);
    if (tokenLimitExceeded(role.tokenPolicy, usage)) {
      if (role.tokenPolicy.action === "block") {
        throw new ChatbotError("rate_limit:chat", "Role Token quota exceeded");
      }
      console.warn("[role-quota] recorded Token limit exceeded", {
        roleId: role.id,
        runId,
      });
    }
  }
}
export async function authorizeRoleRun(
  userId: string,
  model: { provider: string; id: string }
) {
  const catalog = await getUserModelCatalog(userId);
  if (
    !catalog.models.some((item) => item.id === `${model.provider}/${model.id}`)
  ) {
    throw new ChatbotError("forbidden:chat", "Model not authorized");
  }
  await checkUserTokenQuota(userId);
}
