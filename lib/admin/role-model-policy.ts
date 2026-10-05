import { z } from "zod";

export const roleModelPolicySchema = z
  .object({
    allowSwitch: z.boolean(),
    defaultModelId: z.string().min(1).max(512).nullable(),
    enabledModelIds: z.array(z.string().min(1).max(512)).max(500),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (
      new Set(policy.enabledModelIds).size !== policy.enabledModelIds.length ||
      (policy.enabledModelIds.length > 0 && !policy.defaultModelId) ||
      (policy.defaultModelId !== null &&
        !policy.enabledModelIds.includes(policy.defaultModelId))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Default model must be enabled; model IDs must be unique.",
      });
    }
  });
export type RoleModelPolicy = z.infer<typeof roleModelPolicySchema>;

/** Configured roles grant a union. Unconfigured roles do not override explicit restrictions. */
export function resolveRoleModelAccess(
  policies: readonly RoleModelPolicy[],
  availableIds: readonly string[],
  platformDefault: string | null
) {
  const available = new Set(availableIds);
  if (policies.length === 0) {
    return {
      allowSwitch: true,
      defaultModelId: platformDefault,
      modelIds: [...availableIds],
    };
  }
  const granted = new Set(
    policies.flatMap((policy) =>
      policy.allowSwitch
        ? policy.enabledModelIds
        : policy.defaultModelId
          ? [policy.defaultModelId]
          : []
    )
  );
  const modelIds = availableIds.filter((id) => granted.has(id));
  const preferred = policies
    .map((policy) => policy.defaultModelId)
    .find((id) => id !== null && available.has(id) && granted.has(id));
  return {
    allowSwitch: modelIds.length > 1,
    defaultModelId: preferred ?? modelIds[0] ?? null,
    modelIds,
  };
}
