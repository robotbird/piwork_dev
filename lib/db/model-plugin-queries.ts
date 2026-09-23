import "server-only";

import type { ProviderDefinition } from "@piwork/model-provider-sdk";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ChatbotError } from "../errors";
import { type ModelProviderPluginRecord, modelProviderPlugin } from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

async function wrapDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export function listPluginInstallations(): Promise<
  ModelProviderPluginRecord[]
> {
  return wrapDatabase(() =>
    db
      .select()
      .from(modelProviderPlugin)
      .orderBy(asc(modelProviderPlugin.createdAt))
  );
}

export function getPluginInstallation(
  id: string
): Promise<ModelProviderPluginRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .select()
      .from(modelProviderPlugin)
      .where(eq(modelProviderPlugin.id, id))
      .limit(1);
    return record ?? null;
  });
}

export function getPluginInstallationByProviderKey(
  providerKey: string
): Promise<ModelProviderPluginRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .select()
      .from(modelProviderPlugin)
      .where(eq(modelProviderPlugin.providerKey, providerKey))
      .limit(1);
    return record ?? null;
  });
}

export function createPluginInstallation(input: {
  buildHash: string;
  createdBy: string;
  credentialSummary: Record<string, string>;
  credentialsConfigured?: boolean;
  definition: ProviderDefinition;
  defaultModelId: string | null;
  description: string;
  displayName: string;
  enabledModels: string[];
  encryptedCredentials: string;
  packageId: string;
  providerKey: string;
  sha256: string;
  version: string;
}): Promise<ModelProviderPluginRecord> {
  return wrapDatabase(async () => {
    const [record] = await db
      .insert(modelProviderPlugin)
      .values({
        ...input,
        definition: input.definition as unknown as Record<string, unknown>,
        healthStatus: input.credentialsConfigured ? "healthy" : "unknown",
      })
      .returning();
    return record;
  });
}

export function updatePluginInstallation(
  id: string,
  input: Partial<{
    credentialSummary: Record<string, string>;
    credentialsConfigured: boolean;
    defaultModelId: string | null;
    enabled: boolean;
    enabledModels: string[];
    encryptedCredentials: string;
    healthStatus: "unknown" | "healthy" | "degraded" | "failed";
  }>
): Promise<ModelProviderPluginRecord | null> {
  return wrapDatabase(async () =>
    db.transaction(async (tx) => {
      if (input.defaultModelId) {
        await tx
          .update(modelProviderPlugin)
          .set({ defaultModelId: null })
          .where(eq(modelProviderPlugin.enabled, true));
      }
      const [record] = await tx
        .update(modelProviderPlugin)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(modelProviderPlugin.id, id))
        .returning();
      return record ?? null;
    })
  );
}

export async function deletePluginInstallation(id: string): Promise<void> {
  await wrapDatabase(() =>
    db.delete(modelProviderPlugin).where(eq(modelProviderPlugin.id, id))
  );
}
