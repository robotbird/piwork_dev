import { z } from "zod";

/** Per-container limits, not a host capacity reservation or concurrency quota. */
export const sandboxResourceSchema = z
  .object({
    cpuCores: z.number().min(0.25).max(32).multipleOf(0.25),
    memoryMB: z.number().int().min(512).max(32_768).multipleOf(128),
  })
  .strict();

export type SandboxResourcePolicy = z.infer<typeof sandboxResourceSchema>;
export const DEFAULT_SANDBOX_RESOURCE: SandboxResourcePolicy = {
  cpuCores: 2,
  memoryMB: 2048,
};
export const LIGHT_SANDBOX_RESOURCE: SandboxResourcePolicy = {
  cpuCores: 1,
  memoryMB: 768,
};
