import { z } from "zod";

const limit = z.number().int().min(1).max(1_000_000_000_000).nullable();
export const roleTokenPolicySchema = z
  .object({
    action: z.enum(["block", "warn"]),
    daily: limit,
    monthly: limit,
    perRun: limit,
  })
  .strict();
export type RoleTokenPolicy = z.infer<typeof roleTokenPolicySchema>;
export function tokenLimitExceeded(
  policy: RoleTokenPolicy,
  usage: { daily: number; monthly: number; perRun?: number }
) {
  return (
    (policy.daily !== null && usage.daily >= policy.daily) ||
    (policy.monthly !== null && usage.monthly >= policy.monthly) ||
    (policy.perRun !== null &&
      usage.perRun !== undefined &&
      usage.perRun >= policy.perRun)
  );
}
