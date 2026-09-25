import "server-only";

import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ChatbotError } from "../errors";
import {
  type PiPackageRecord,
  type PiPackageResourceSummary,
  piPackage,
} from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

async function wrapDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export function listPiPackages(): Promise<PiPackageRecord[]> {
  return wrapDatabase(() =>
    db.select().from(piPackage).orderBy(asc(piPackage.createdAt))
  );
}

export function getPiPackageBySource(
  source: string
): Promise<PiPackageRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .select()
      .from(piPackage)
      .where(eq(piPackage.source, source))
      .limit(1);
    return record ?? null;
  });
}

export function getSystemPiPackage(): Promise<PiPackageRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .select()
      .from(piPackage)
      .where(eq(piPackage.system, true))
      .limit(1);
    return record ?? null;
  });
}

export function createPiPackage(input: {
  createdBy: string | null;
  installedPath: string;
  installedSkills: string[];
  name: string;
  resourceSummary: PiPackageResourceSummary;
  source: string;
  system: boolean;
  version: string;
}): Promise<PiPackageRecord> {
  return wrapDatabase(async () => {
    const [record] = await db.insert(piPackage).values(input).returning();
    return record;
  });
}

export function updatePiPackage(
  source: string,
  set: Partial<{
    installedPath: string;
    installedSkills: string[];
    name: string;
    resourceSummary: PiPackageResourceSummary;
    system: boolean;
    updatedAt: Date;
    version: string;
  }>
): Promise<PiPackageRecord | null> {
  return wrapDatabase(async () => {
    const [record] = await db
      .update(piPackage)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(piPackage.source, source))
      .returning();
    return record ?? null;
  });
}

export function deletePiPackage(source: string): Promise<boolean> {
  return wrapDatabase(async () => {
    const [record] = await db
      .delete(piPackage)
      .where(eq(piPackage.source, source))
      .returning();
    return record !== undefined;
  });
}
