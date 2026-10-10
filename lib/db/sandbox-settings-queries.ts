import "server-only";
import { eq, sql } from "drizzle-orm";
import {
  DEFAULT_SANDBOX_RESOURCE,
  type SandboxResourcePolicy,
  sandboxResourceSchema,
} from "../runtime/sandbox/resource-policy";
import { getDb } from "./client";
import { sandboxSettings } from "./schema";

const SETTINGS_ID = "default";

/** No process cache: each new RPC session sees the latest committed policy.
 * Database errors/invalid stored values fail closed, never silently use defaults.
 */
export async function getSandboxResourcePolicy(): Promise<SandboxResourcePolicy> {
  const [row] = await getDb()
    .select({
      cpuCores: sandboxSettings.cpuCores,
      memoryMB: sandboxSettings.memoryMB,
    })
    .from(sandboxSettings)
    .where(eq(sandboxSettings.id, SETTINGS_ID));
  return sandboxResourceSchema.parse(row ?? DEFAULT_SANDBOX_RESOURCE);
}

export async function saveSandboxResourcePolicy(
  input: SandboxResourcePolicy,
  userId: string
) {
  const policy = sandboxResourceSchema.parse(input);
  const [row] = await getDb()
    .insert(sandboxSettings)
    .values({
      ...policy,
      id: SETTINGS_ID,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      set: { ...policy, updatedAt: sql`now()`, updatedBy: userId },
      target: sandboxSettings.id,
    })
    .returning({
      cpuCores: sandboxSettings.cpuCores,
      memoryMB: sandboxSettings.memoryMB,
    });
  return sandboxResourceSchema.parse(row);
}
