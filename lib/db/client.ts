import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

type Clock = "default" | "UTC";

function createDatabase(url: string, clock: Clock) {
  return drizzle(
    postgres(url, {
      ...(clock === "UTC" ? { connection: { TimeZone: "UTC" } } : {}),
      idle_timeout: 20,
      max: clock === "UTC" ? 2 : 5,
    })
  );
}

// Next route bundles and development HMR must reuse pools within this process.
// URL is part of the key so isolated test schemas/configurations cannot alias.
const shared = globalThis as typeof globalThis & {
  piworkDatabasesV1?: Map<string, ReturnType<typeof createDatabase>>;
};
const databases: Map<
  string,
  ReturnType<typeof createDatabase>
> = shared.piworkDatabasesV1 ?? new Map();
shared.piworkDatabasesV1 = databases;

/** Preserve the default DB clock; SandboxInstance requires a separate UTC pool. */
export function getDb(clock: Clock = "default") {
  const url = process.env.POSTGRES_URL ?? "";
  const key = JSON.stringify([url, clock]);
  let db = databases.get(key);
  if (!db) {
    db = createDatabase(url, clock);
    databases.set(key, db);
  }
  return db;
}
