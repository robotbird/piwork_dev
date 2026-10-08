/**
 * 数据库初始化引导脚本（幂等，可重复执行）：
 * 1. 运行 drizzle 迁移（独立单连接，与 lib/db/migrate.ts 口径一致）；
 * 2. 写入系统角色种子并回填成员角色关系（ensureSystemRolesSeeded）；
 * 3. 尚无任何管理员时，创建初始管理员账号（邮箱/密码可用环境变量覆盖）。
 *
 * 用法（react-server 条件用于加载带 "server-only" 的查询模块）：
 *   NODE_OPTIONS="--conditions react-server" pnpm exec tsx scripts/init-database.ts
 * 可选环境变量：
 *   INIT_ADMIN_EMAIL（默认 admin@piwork.local）
 *   INIT_ADMIN_PASSWORD（默认 piwork-admin-123）
 *   INIT_ADMIN_NAME（默认 平台管理员）
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL not defined (check .env.local)");
  }

  console.log("[1/3] Running migrations...");
  // 迁移使用独立单连接，不复用应用查询池
  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  await migrate(drizzle(connection), {
    migrationsFolder: "./lib/db/migrations",
  });
  await connection.end();
  console.log("Migrations completed.");

  console.log("[2/3] Seeding system roles...");
  const { ensureSystemRolesSeeded } = await import("../lib/db/role-queries");
  await ensureSystemRolesSeeded();
  console.log("System roles seeded.");

  console.log("[3/3] Ensuring initial admin...");
  const {
    countEnabledAdmins,
    createMemberWithAccount,
  } = await import("../lib/db/organization-queries");
  const adminCount = await countEnabledAdmins();
  if (adminCount > 0) {
    console.log(`Found ${adminCount} existing admin(s), skipping bootstrap.`);
    return;
  }

  const email = process.env.INIT_ADMIN_EMAIL ?? "admin@piwork.local";
  const password = process.env.INIT_ADMIN_PASSWORD ?? "piwork-admin-123";
  const name = process.env.INIT_ADMIN_NAME ?? "平台管理员";

  const created = await createMemberWithAccount({
    departmentId: null,
    email,
    name,
    password,
    role: "admin",
    title: null,
  });
  console.log(`Initial admin created: ${created.email} (memberId ${created.id})`);

  // 系统角色种子需要成员存在后才能回填超级管理员归属，再执行一次
  await ensureSystemRolesSeeded();
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Database init failed:");
    console.error(error);
    process.exit(1);
  });
