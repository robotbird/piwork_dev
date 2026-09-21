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
  /** 待删除的模型供应商名 LIKE 模式（其下模型随外键级联删除） */
  providerPatterns?: readonly string[];
};

/** 删除测试产生的数据，保持开发库干净；账号删除会级联清理成员与角色关系 */
export async function cleanupTestData(scope: TestCleanupScope): Promise<void> {
  const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  try {
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
    if (
      scope.providerPatterns !== undefined &&
      scope.providerPatterns.length > 0
    ) {
      await sql`DELETE FROM "ModelProvider" WHERE "name" LIKE ANY(${[
        ...scope.providerPatterns,
      ]})`;
    }
  } finally {
    await sql.end();
  }
}
