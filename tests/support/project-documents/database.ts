import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

/** Schema-only scope: no real users, runs, model config or public fallback. */
export async function createProjectDocumentDatabase(sourceUrl: string) {
  const owner = postgres(sourceUrl, { max: 1, onnotice: () => undefined });
  const name = `piwork_documents_${crypto.randomUUID().replaceAll("-", "")}`;
  const url = new URL(sourceUrl);
  url.searchParams.set("search_path", name);
  await owner.unsafe(`CREATE SCHEMA "${name}"`);
  const sql = postgres(url.toString(), { max: 1, onnotice: () => undefined });
  try {
    const [scope] = await sql`SELECT current_schema() as name`;
    if (scope.name !== name) {
      throw new Error("isolated schema not applied");
    }
    await sql.begin(async (tx) => {
      for (const migration of readMigrationFiles({
        migrationsFolder: "lib/db/migrations",
      })) {
        for (const statement of migration.sql) {
          // biome-ignore lint/performance/noAwaitInLoops: migrations require ordered DDL in this isolated schema
          await tx.unsafe(statement.replaceAll('"public".', `"${name}".`));
        }
      }
    });
  } catch (error) {
    await sql.end();
    await owner.unsafe(`DROP SCHEMA "${name}" CASCADE`);
    await owner.end();
    throw error;
  }
  return {
    close: async () => {
      await sql.end();
      await owner.unsafe(`DROP SCHEMA "${name}" CASCADE`);
      await owner.end();
    },
    sql,
    url: url.toString(),
  };
}
