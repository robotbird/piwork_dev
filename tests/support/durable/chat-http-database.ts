import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

/** RunManager's single-host orphan sweep must never see the developer's runs
 * from a second server. Use a unique schema and a schema-only search_path (NO
 * public fallback). Migrations' explicit public FK targets are remapped only in
 * this fixture. Copy encrypted model config, never users/chats/tasks.
 */
export async function createDurableChatHttpDatabase(sourceUrl: string) {
  const source = postgres(sourceUrl, { max: 1, onnotice: () => undefined });
  const name = `piwork_durable_probe_${crypto.randomUUID().replaceAll("-", "")}`;
  const url = new URL(sourceUrl);
  url.searchParams.set("search_path", name);
  // Bound default pools in the validation server; leave the developer app alone.
  url.searchParams.set("max", "2");
  let target: ReturnType<typeof postgres> | undefined;
  try {
    await source.unsafe(`CREATE SCHEMA "${name}"`);
    target = postgres(url.toString(), { max: 1, onnotice: () => undefined });
    const [scope] = await target`SELECT current_schema() AS name`;
    if (scope.name !== name) {
      throw new Error("isolated-search-path-not-applied");
    }
    const migrations = readMigrationFiles({
      migrationsFolder: "lib/db/migrations",
    });
    await target.begin(async (transaction) => {
      for (const migration of migrations) {
        for (const statement of migration.sql) {
          // biome-ignore lint/performance/noAwaitInLoops: ordered DDL within isolated schema transaction
          await transaction.unsafe(
            statement.replaceAll('"public".', `"${name}".`)
          );
        }
      }
    });
    const targetSql = target;
    const models =
      await source`SELECT * FROM "ModelProviderPlugin" WHERE enabled = true`;
    if (models.length) {
      await target`INSERT INTO "ModelProviderPlugin" ${target(
        models.map((row) => ({
          ...row,
          createdBy: null,
          credentialSummary: targetSql.json(row.credentialSummary),
          definition: targetSql.json(row.definition),
          enabledModels: targetSql.json(row.enabledModels),
        }))
      )}`;
    }
    const sql = target;
    return {
      close: async (remove: boolean) => {
        await sql.end();
        if (remove) {
          await source.unsafe(`DROP SCHEMA "${name}" CASCADE`);
        }
        await source.end();
      },
      name,
      sql,
      url: url.toString(),
    };
  } catch (error) {
    await target?.end();
    await source.end();
    throw new Error(
      `durable-chat-http:isolated-schema-setup-failed (${name}); inspect or remove this test schema manually`,
      { cause: error }
    );
  }
}
