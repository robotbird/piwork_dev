import "server-only";

import { asc, eq } from "drizzle-orm";
import { ChatbotError } from "../errors";
import { getDb } from "./client";
import { type McpServerRecord, mcpServer } from "./schema";

const db = getDb();

async function wrapDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export function listMcpServers(): Promise<McpServerRecord[]> {
  return wrapDatabase(() =>
    db.select().from(mcpServer).orderBy(asc(mcpServer.createdAt))
  );
}

export function getMcpServer(id: string): Promise<McpServerRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.id, id))
      .limit(1);
    return record ?? null;
  });
}

export function getMcpServerByName(
  name: string
): Promise<McpServerRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.name, name))
      .limit(1);
    return record ?? null;
  });
}

export function createMcpServer(input: {
  args: string[];
  command: string | null;
  createdBy: string;
  description: string;
  enabled: boolean;
  env: Record<string, string>;
  headers: Record<string, string>;
  name: string;
  transport: "stdio" | "http";
  url: string | null;
}): Promise<McpServerRecord> {
  return wrapDatabase(async () => {
    const [record] = await db
      .insert(mcpServer)
      .values({
        ...input,
        command: input.transport === "stdio" ? input.command : null,
        url: input.transport === "http" ? input.url : null,
      })
      .returning();
    return record;
  });
}

export function updateMcpServer(
  id: string,
  input: Partial<{
    args: string[];
    command: string | null;
    description: string;
    enabled: boolean;
    env: Record<string, string>;
    headers: Record<string, string>;
    name: string;
    transport: "stdio" | "http";
    url: string | null;
  }>
): Promise<McpServerRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .update(mcpServer)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(mcpServer.id, id))
      .returning();
    return record ?? null;
  });
}

export async function deleteMcpServer(id: string): Promise<void> {
  await wrapDatabase(() => db.delete(mcpServer).where(eq(mcpServer.id, id)));
}
