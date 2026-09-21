import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ChatbotError } from "../errors";
import type {
  ModelProviderSummary,
  ProviderDetailView,
  ProviderModelItem,
  ProviderModelType,
  ProvidersView,
} from "../management/models";
import {
  type ModelProviderRecord,
  modelProvider,
  type ProviderModelRecord,
  providerModel,
} from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export type ProviderInput = {
  apiKey: string;
  baseUrl: string;
  description: string | null;
  enabled?: boolean;
  name: string;
};

export type ModelInput = {
  enabled?: boolean;
  isDefault?: boolean;
  modelId: string;
  name: string;
  type: ProviderModelType;
};

async function wrapDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

function toModelItem(record: ProviderModelRecord): ProviderModelItem {
  return {
    createdAt: record.createdAt.toISOString(),
    enabled: record.enabled,
    id: record.id,
    isDefault: record.isDefault,
    modelId: record.modelId,
    name: record.name,
    type: record.type as ProviderModelType,
  };
}

/** 供应商列表视图：按创建时间倒序，附带各供应商下的模型数量 */
export async function loadProvidersView(): Promise<ProvidersView> {
  const rows = await wrapDatabase(() =>
    db
      .select({
        createdAt: modelProvider.createdAt,
        description: modelProvider.description,
        enabled: modelProvider.enabled,
        id: modelProvider.id,
        modelCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${providerModel}
          WHERE ${providerModel.providerId} = ${modelProvider.id}
        )`,
        name: modelProvider.name,
        protocol: modelProvider.protocol,
      })
      .from(modelProvider)
      .orderBy(desc(modelProvider.createdAt))
  );

  return {
    providers: rows.map<ModelProviderSummary>((row) => ({
      createdAt: row.createdAt.toISOString(),
      description: row.description,
      enabled: row.enabled,
      id: row.id,
      modelCount: row.modelCount,
      name: row.name,
      protocol: row.protocol as ModelProviderSummary["protocol"],
    })),
  };
}

/** 供应商详情视图（含明文 API Key，仅限管理端详情接口使用） */
export async function loadProviderDetailView(
  providerId: string
): Promise<ProviderDetailView | null> {
  const provider = await getProviderById(providerId);
  if (!provider) {
    return null;
  }
  const models = await wrapDatabase(() =>
    db
      .select()
      .from(providerModel)
      .where(eq(providerModel.providerId, providerId))
      .orderBy(desc(providerModel.isDefault), asc(providerModel.createdAt))
  );

  return {
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    createdAt: provider.createdAt.toISOString(),
    description: provider.description,
    enabled: provider.enabled,
    id: provider.id,
    models: models.map(toModelItem),
    name: provider.name,
    protocol: provider.protocol as ProviderDetailView["protocol"],
    updatedAt: provider.updatedAt.toISOString(),
  };
}

export function getProviderById(
  providerId: string
): Promise<ModelProviderRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .select()
      .from(modelProvider)
      .where(eq(modelProvider.id, providerId))
      .limit(1);
    return record ?? null;
  });
}

export function getModelById(
  modelId: string
): Promise<ProviderModelRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .select()
      .from(providerModel)
      .where(eq(providerModel.id, modelId))
      .limit(1);
    return record ?? null;
  });
}

export function listProviderNames(): Promise<string[]> {
  return wrapDatabase(async () => {
    const rows = await db
      .select({ name: modelProvider.name })
      .from(modelProvider);
    return rows.map((row) => row.name);
  });
}

export function listModelIdsUnderProvider(
  providerId: string
): Promise<string[]> {
  return wrapDatabase(async () => {
    const rows = await db
      .select({ modelId: providerModel.modelId })
      .from(providerModel)
      .where(eq(providerModel.providerId, providerId));
    return rows.map((row) => row.modelId);
  });
}

export function createProviderRecord(
  input: ProviderInput
): Promise<ModelProviderRecord> {
  return wrapDatabase(async () => {
    const [record] = await db
      .insert(modelProvider)
      .values({
        apiKey: input.apiKey,
        baseUrl: input.baseUrl,
        description: input.description,
        enabled: input.enabled ?? true,
        name: input.name,
      })
      .returning();
    return record;
  });
}

/** 更新供应商；apiKey 传 null 表示保留原凭证 */
export function updateProviderRecord(
  providerId: string,
  input: Partial<Omit<ProviderInput, "name">> & { name?: string }
): Promise<ModelProviderRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .update(modelProvider)
      .set({
        ...(input.apiKey === undefined ? {} : { apiKey: input.apiKey }),
        ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(input.name === undefined ? {} : { name: input.name }),
        updatedAt: new Date(),
      })
      .where(eq(modelProvider.id, providerId))
      .returning();
    return record ?? null;
  });
}

/** 删除供应商；其下模型随外键级联删除，默认模型若在其中则一并消失 */
export async function deleteProviderRecord(providerId: string): Promise<void> {
  await wrapDatabase(async () => {
    await db.delete(modelProvider).where(eq(modelProvider.id, providerId));
  });
}

export function createModelRecord(
  providerId: string,
  input: ModelInput
): Promise<ProviderModelRecord> {
  return wrapDatabase(async () => {
    const result = await db.transaction(async (tx) => {
      const [record] = await tx
        .insert(providerModel)
        .values({
          enabled: input.enabled ?? true,
          isDefault: false,
          modelId: input.modelId,
          name: input.name,
          providerId,
          type: input.type,
        })
        .returning();
      // 新建时勾选默认：先清掉既有默认，再标记当前模型
      if (input.isDefault) {
        await tx
          .update(providerModel)
          .set({ isDefault: false })
          .where(eq(providerModel.isDefault, true));
        const [marked] = await tx
          .update(providerModel)
          .set({ isDefault: true })
          .where(eq(providerModel.id, record.id))
          .returning();
        return marked ?? record;
      }
      return record;
    });
    return result;
  });
}

/** 更新模型；设为默认时在事务内清掉其余默认标记 */
export function updateModelRecord(
  modelId: string,
  input: Partial<ModelInput>
): Promise<ProviderModelRecord | null> {
  return wrapDatabase(async () => {
    const result = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(providerModel)
        .set({
          ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
          ...(input.modelId === undefined ? {} : { modelId: input.modelId }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.type === undefined ? {} : { type: input.type }),
          updatedAt: new Date(),
        })
        .where(eq(providerModel.id, modelId))
        .returning();
      if (!record) {
        return null;
      }
      if (input.isDefault !== undefined) {
        if (input.isDefault) {
          await tx
            .update(providerModel)
            .set({ isDefault: false })
            .where(eq(providerModel.isDefault, true));
          const [marked] = await tx
            .update(providerModel)
            .set({ isDefault: true })
            .where(eq(providerModel.id, modelId))
            .returning();
          return marked ?? record;
        }
        const [unmarked] = await tx
          .update(providerModel)
          .set({ isDefault: false })
          .where(eq(providerModel.id, modelId))
          .returning();
        return unmarked ?? record;
      }
      return record;
    });
    return result;
  });
}

/** 停用或删除默认模型时同步取消默认标记，保证全库至多一条默认 */
export function clearDefaultIfMatches(modelId: string): Promise<boolean> {
  return wrapDatabase(async () => {
    const rows = await db
      .update(providerModel)
      .set({ isDefault: false })
      .where(
        sql`${providerModel.id} = ${modelId} AND ${providerModel.isDefault}`
      )
      .returning({ id: providerModel.id });
    return rows.length > 0;
  });
}

/** 停用供应商时取消其下默认模型的默认标记（默认模型必须始终可用） */
export async function clearDefaultsUnderProvider(
  providerId: string
): Promise<void> {
  await wrapDatabase(async () => {
    await db
      .update(providerModel)
      .set({ isDefault: false })
      .where(
        sql`${providerModel.providerId} = ${providerId} AND ${providerModel.isDefault}`
      );
  });
}

export async function deleteModelRecord(modelId: string): Promise<void> {
  await wrapDatabase(async () => {
    await db.delete(providerModel).where(eq(providerModel.id, modelId));
  });
}
