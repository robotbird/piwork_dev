import { type APIResponse, expect, type Page, test } from "@playwright/test";
import { cleanupTestData } from "./helpers/test-cleanup";

const ROLES_URL = "/management/organization?view=permissions";
const DEFAULT_PASSWORD = "test123456";

/** 与接口一致的角色视图（仅测试中用到的字段） */
type RoleView = {
  code: string | null;
  description: string | null;
  id: string;
  memberIds: string[];
  memberLimit: number | null;
  name: string;
  type: "system" | "custom";
};

type MemberView = {
  email: string;
  id: string;
  name: string | null;
  role: "admin" | "member";
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 注册独立账号并等待跳转到应用首页；返回邮箱 */
async function registerAccount(page: Page): Promise<string> {
  const email = `roles-e2e-${uniqueSuffix()}@test.local`;
  await page.goto("/register");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    { timeout: 30_000 }
  );
  return email;
}

/** 通过管理接口读取角色列表 */
async function fetchRoles(page: Page): Promise<RoleView[]> {
  const response = await page.request.get("/api/management/roles");
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()) as { roles: RoleView[] };
  return data.roles;
}

/** 按名称查找角色 */
async function findRoleByName(
  page: Page,
  name: string
): Promise<RoleView | undefined> {
  const roles = await fetchRoles(page);
  return roles.find((role) => role.name === name);
}

/** 按名称查找角色，缺失时直接让用例失败 */
async function requireRoleByName(page: Page, name: string): Promise<RoleView> {
  const role = await findRoleByName(page, name);
  if (!role) {
    throw new Error(`Role not found: ${name}`);
  }
  return role;
}

/** 通过成员接口创建成员（返回成员视图，用于角色成员选择） */
async function createMemberViaApi(
  page: Page,
  input: { email: string; name: string; role?: "admin" | "member" }
): Promise<MemberView> {
  const response = await page.request.post("/api/management/members", {
    data: {
      departmentId: null,
      email: input.email,
      name: input.name,
      password: DEFAULT_PASSWORD,
      role: input.role ?? "member",
      title: null,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as MemberView;
}

/** 设置角色成员（整体替换语义） */
function setRoleMembersViaApi(
  page: Page,
  roleId: string,
  memberIds: string[]
): Promise<APIResponse> {
  return page.request.put(`/api/management/roles/${roleId}/members`, {
    data: { memberIds },
  });
}

/** 按名称精确定位角色行 */
function roleRowByName(page: Page, name: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(name, { exact: true }) });
}

test.describe
  .serial("Role Management", () => {
    // 语言随 Accept-Language 协商，固定为中文保证文案断言稳定
    test.use({ locale: "zh-CN" });

    // 用例结束后清理本套件注册的账号与创建的自定义角色，保持开发库干净
    test.afterAll(async () => {
      await cleanupTestData({
        emailPatterns: ["roles-%@test.local"],
        rolePatterns: ["Skill 开发者%", "数据分析师%", "临时角色%"],
      });
    });

    test("seeds system roles and renders the roles page", async ({ page }) => {
      await registerAccount(page);

      // 系统角色在首次访问时自动创建，超级管理员唯一且已被指派
      const roles = await fetchRoles(page);
      for (const name of ["超级管理员", "管理员", "普通成员", "审计员"]) {
        expect(
          roles.some((role) => role.name === name),
          name
        ).toBeTruthy();
      }
      const superAdmin = roles.find((role) => role.name === "超级管理员");
      expect(superAdmin?.memberLimit).toBe(1);
      expect(superAdmin?.memberIds).toHaveLength(1);

      await page.goto(ROLES_URL);
      await expect(
        page.getByRole("heading", { name: "角色与权限" })
      ).toBeVisible();

      // 系统角色行展示「系统」徽章与成员数
      const superAdminRow = roleRowByName(page, "超级管理员");
      await expect(superAdminRow).toContainText("系统");
      await expect(superAdminRow).toContainText("拥有系统所有权限");
    });

    test("creates a custom role via the dialog", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);
      await page.goto(ROLES_URL);

      const roleName = `Skill 开发者-${suffix}`;
      // 头部按钮文案走 legacy key 映射（management.createRole），两种叫法都兼容
      await page.getByRole("button", { name: /^(新建角色|创建角色)$/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("#role-name").fill(roleName);
      await dialog
        .locator("#role-description")
        .fill("可创建、管理和发布 Skill");
      await dialog.getByRole("button", { name: "创建角色" }).click();
      await expect(dialog).toBeHidden();

      const row = roleRowByName(page, roleName);
      await expect(row).toContainText("自定义");
      await expect(row).toContainText("可创建、管理和发布 Skill");
      await expect(row).toContainText("0");

      // 重名创建被拒绝
      await page.getByRole("button", { name: /^(新建角色|创建角色)$/ }).click();
      await dialog.locator("#role-name").fill(roleName);
      await dialog.getByRole("button", { name: "创建角色" }).click();
      await expect(dialog.getByText("已存在同名角色")).toBeVisible();
      await dialog.getByRole("button", { name: "取消" }).click();
    });

    test("selects and removes members in a custom role", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);

      const memberA = await createMemberViaApi(page, {
        email: `roles-member-a-${suffix}@test.local`,
        name: "赵角色",
      });
      const memberB = await createMemberViaApi(page, {
        email: `roles-member-b-${suffix}@test.local`,
        name: "钱角色",
      });

      const roleName = `数据分析师-${suffix}`;
      const created = await page.request.post("/api/management/roles", {
        data: { description: "可使用数据分析相关功能", name: roleName },
      });
      expect(created.ok()).toBeTruthy();
      const role = (await created.json()) as RoleView;

      await page.goto(ROLES_URL);
      const row = roleRowByName(page, roleName);

      // 通过行内「⋯」菜单打开角色详情并进入成员选择
      await row.getByRole("button", { name: /更多操作/ }).click();
      await page.getByRole("menuitem", { name: "管理成员" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "选择成员" }).click();

      // 搜索并勾选两名成员
      await dialog
        .getByRole("searchbox", { name: "搜索成员" })
        .fill(memberA.email);
      await dialog
        .getByRole("button", { name: new RegExp(memberA.email) })
        .click();
      await dialog
        .getByRole("searchbox", { name: "搜索成员" })
        .fill(memberB.email);
      await dialog
        .getByRole("button", { name: new RegExp(memberB.email) })
        .click();
      await dialog.getByRole("button", { name: "保存" }).click();
      await expect(page.getByText(`已更新「${roleName}」的成员`)).toBeVisible();

      // 详情弹窗即时更新：成员数 2 人，两名成员可见
      // （弹窗打开时表格处于 inert 状态，页面断言需在关闭后进行）
      await expect(dialog).toContainText("2 人");
      await expect(dialog).toContainText(memberA.email);
      await expect(dialog).toContainText(memberB.email);

      // 移出一名成员后详情回到 1 人
      await dialog.getByRole("button", { name: "移出成员 钱角色" }).click();
      await expect(dialog).not.toContainText(memberB.email);
      await expect(dialog).toContainText("1 人");

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(row).toContainText("1");

      // 接口校验最终成员关系
      const finalRole = await findRoleByName(page, roleName);
      expect(finalRole?.memberIds).toEqual([memberA.id]);
      expect(role.memberLimit).toBeNull();
    });

    test("keeps the super administrator unique and syncs admin access", async ({
      page,
    }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);

      const member = await createMemberViaApi(page, {
        email: `roles-super-${suffix}@test.local`,
        name: "孙超管",
        role: "member",
      });

      const superAdmin = await requireRoleByName(page, "超级管理员");
      const [originalId] = superAdmin.memberIds;

      // 超级管理员仅可设置 1 名成员
      const invalid = await setRoleMembersViaApi(page, superAdmin.id, [
        originalId,
        member.id,
      ]);
      expect(invalid.status()).toBe(409);

      // 转移超级管理员：新成员获得管理员权限
      const transfer = await setRoleMembersViaApi(page, superAdmin.id, [
        member.id,
      ]);
      expect(transfer.ok()).toBeTruthy();
      const membersResponse = await page.request.get("/api/management/members");
      const membersData = (await membersResponse.json()) as {
        members: MemberView[];
      };
      const transferred = membersData.members.find(
        (item) => item.id === member.id
      );
      expect(transferred?.role).toBe("admin");

      // 还原超级管理员，避免影响其他用例
      const restore = await setRoleMembersViaApi(page, superAdmin.id, [
        originalId,
      ]);
      expect(restore.ok()).toBeTruthy();
    });

    test("protects system roles from edit and delete", async ({ page }) => {
      await registerAccount(page);
      const auditor = await requireRoleByName(page, "审计员");

      const patched = await page.request.patch("/api/management/roles", {
        data: { description: "改描述", id: auditor.id, name: "审计员2" },
      });
      expect(patched.status()).toBe(403);

      const deleted = await page.request.delete("/api/management/roles", {
        data: { id: auditor.id },
      });
      expect(deleted.status()).toBe(403);
      expect(await findRoleByName(page, "审计员")).toBeDefined();
    });

    test("edits and deletes a custom role", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);

      const roleName = `临时角色-${suffix}`;
      const created = await page.request.post("/api/management/roles", {
        data: { description: null, name: roleName },
      });
      const role = (await created.json()) as RoleView;

      const patched = await page.request.patch("/api/management/roles", {
        data: {
          description: "更新后的描述",
          id: role.id,
          name: `${roleName}改`,
        },
      });
      expect(patched.ok()).toBeTruthy();
      expect(await findRoleByName(page, `${roleName}改`)).toBeDefined();

      const deleted = await page.request.delete("/api/management/roles", {
        data: { id: role.id },
      });
      expect(deleted.ok()).toBeTruthy();
      expect(await findRoleByName(page, `${roleName}改`)).toBeUndefined();
    });
  });
