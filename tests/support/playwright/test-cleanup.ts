import { config } from "dotenv";
import postgres from "postgres";

// tsx 直接运行脚本时不会经过 playwright 配置，这里自行加载环境变量
config({ path: ".env.local" });

export type TestCleanupScope = {
  /** 待删除账号的邮箱 LIKE 模式（成员与角色关系随外键级联删除） */
  emailPatterns: readonly string[];
  /** 待删除的自定义角色名 LIKE 模式 */
  rolePatterns?: readonly string[];
  /** 待删除的部门名 LIKE 模式 */
  departmentPatterns?: readonly string[];
  /** 待卸载的模型插件包 id（插件安装不随创建者账号级联删除） */
  modelPluginPackageIds?: readonly string[];
  /** 待删除的 MCP 服务名（精确匹配） */
  mcpServerNames?: readonly string[];
  /** 待删除的 pi 包安装记录 source（精确匹配） */
  piPackageSources?: readonly string[];
  /** 待删除的技能来源包标识（按 Skill.sourcePackage 删） */
  skillSourcePackages?: readonly string[];
};

/** 删除测试产生的数据，保持开发库干净；账号删除会级联清理成员与角色关系 */
export async function cleanupTestData(scope: TestCleanupScope): Promise<void> {
  const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  try {
    if (
      scope.skillSourcePackages !== undefined &&
      scope.skillSourcePackages.length > 0
    ) {
      await sql`DELETE FROM "Skill" WHERE "sourcePackage" = ANY(${[
        ...scope.skillSourcePackages,
      ]})`;
    }
    if (
      scope.piPackageSources !== undefined &&
      scope.piPackageSources.length > 0
    ) {
      await sql`DELETE FROM "PiPackage" WHERE "source" = ANY(${[
        ...scope.piPackageSources,
      ]})`;
    }
    if (scope.mcpServerNames !== undefined && scope.mcpServerNames.length > 0) {
      await sql`DELETE FROM "McpServer" WHERE "name" = ANY(${[
        ...scope.mcpServerNames,
      ]})`;
    }
    if (
      scope.modelPluginPackageIds !== undefined &&
      scope.modelPluginPackageIds.length > 0
    ) {
      // 仅删测试账号创建的安装:开发库与真实使用共享,按 packageId 无差别
      // 删除会误杀管理员手动配置的真实插件(2026-09-26 实际发生过)。
      // createdBy 是 set null 外键,不在用户删除时级联,须在删用户前处理。
      await sql`DELETE FROM "ModelProviderPlugin"
        WHERE "packageId" = ANY(${[...scope.modelPluginPackageIds]})
        AND "createdBy" IN (
          SELECT "id" FROM "User" WHERE "email" LIKE ANY(${[
            ...scope.emailPatterns,
          ]})
        )`;
    }
    // Chat.userId / Vote / Message 外键无级联：先删 chat 依赖链再删账号；
    // Chat 级联清 AgentRun → RuntimeEvent/RuntimeLease（v2.0 Step 2）。
    // 无 chat 的账号此三句均为 no-op。
    await sql`DELETE FROM "Vote_v2" WHERE "chatId" IN (
      SELECT "id" FROM "Chat" WHERE "userId" IN (
        SELECT "id" FROM "User" WHERE "email" LIKE ANY(${[
          ...scope.emailPatterns,
        ]})
      )
    )`;
    await sql`DELETE FROM "Message_v2" WHERE "chatId" IN (
      SELECT "id" FROM "Chat" WHERE "userId" IN (
        SELECT "id" FROM "User" WHERE "email" LIKE ANY(${[
          ...scope.emailPatterns,
        ]})
      )
    )`;
    await sql`DELETE FROM "Chat" WHERE "userId" IN (
      SELECT "id" FROM "User" WHERE "email" LIKE ANY(${[
        ...scope.emailPatterns,
      ]})
    )`;
    await sql`DELETE FROM "User" WHERE "email" LIKE ANY(${[
      ...scope.emailPatterns,
    ]})`;
    if (scope.rolePatterns !== undefined && scope.rolePatterns.length > 0) {
      await sql`DELETE FROM "Role" WHERE "type" = 'custom' AND "name" LIKE ANY(${[
        ...scope.rolePatterns,
      ]})`;
    }
    if (
      scope.departmentPatterns !== undefined &&
      scope.departmentPatterns.length > 0
    ) {
      await sql`DELETE FROM "Department" WHERE "name" LIKE ANY(${[
        ...scope.departmentPatterns,
      ]})`;
    }
  } finally {
    await sql.end();
  }
}
