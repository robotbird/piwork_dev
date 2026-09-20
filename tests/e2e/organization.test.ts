import { expect, type Page, test } from "@playwright/test";
import { cleanupTestData } from "./helpers/test-cleanup";

const ORGANIZATION_URL = "/management/organization";

type DepartmentView = {
  id: string;
  leaderId: string | null;
  name: string;
  parentId: string | null;
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 注册独立账号并等待跳转到应用首页；返回邮箱 */
async function registerAccount(page: Page): Promise<string> {
  const email = `org-e2e-${uniqueSuffix()}@test.local`;
  await page.goto("/register");
  // 注册页文案跟随语言偏好（默认中文），用稳定的字段 id 与双语按钮匹配
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("test123456");
  await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    { timeout: 30_000 }
  );
  return email;
}

/** 通过管理接口创建部门 */
async function createDepartmentViaApi(
  page: Page,
  name: string,
  parentId: string | null = null
): Promise<DepartmentView> {
  const response = await page.request.post("/api/management/organization", {
    data: { leaderId: null, name, parentId },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as DepartmentView;
}

/** 通过管理接口创建成员并分配部门 */
async function createMemberViaApi(
  page: Page,
  input: { departmentId?: string | null; email: string; name: string }
) {
  const response = await page.request.post("/api/management/members", {
    data: {
      departmentId: input.departmentId ?? null,
      email: input.email,
      name: input.name,
      password: "test123456",
      role: "member",
      title: null,
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test.describe
  .serial("Organization Management", () => {
    // 用例结束后清理本套件注册的账号、创建的成员与部门，保持开发库干净
    test.afterAll(async () => {
      await cleanupTestData({
        departmentPatterns: ["人事部-%"],
        emailPatterns: ["org-e2e-%@test.local", "org-member-%@company.com"],
      });
    });

    test("creates a root department and a child department", async ({
      page,
    }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);
      await page.goto(ORGANIZATION_URL);
      await expect(
        page.getByRole("heading", { name: "组织架构" })
      ).toBeVisible();

      const rootName = `总部-${suffix}`;
      await page.getByRole("button", { name: "新建部门" }).click();
      const createDialog = page.getByRole("dialog");
      await expect(
        createDialog.getByRole("heading", { name: "新建部门" })
      ).toBeVisible();
      await createDialog.getByLabel("部门名称").fill(rootName);
      await createDialog.getByRole("button", { name: "创建部门" }).click();

      await expect(page.getByText(`已创建部门「${rootName}」`)).toBeVisible();
      const rootItem = page.getByRole("treeitem", { name: rootName });
      await expect(rootItem).toBeVisible();
      // 创建后自动选中，右侧详情面板展示该部门
      await expect(page.getByRole("heading", { name: rootName })).toBeVisible();
      await expect(page.getByText("未设置").first()).toBeVisible();

      const childName = `研发中心-${suffix}`;
      await page.getByRole("button", { name: "新建部门" }).click();
      await createDialog.getByLabel("部门名称").fill(childName);
      // 上级部门默认选中当前选中部门（刚创建的顶级部门）
      await expect(createDialog.locator("#department-parent")).toContainText(
        rootName
      );
      await createDialog.getByRole("button", { name: "创建部门" }).click();

      await expect(page.getByText(`已创建部门「${childName}」`)).toBeVisible();
      // 子部门创建后父部门自动展开，树中可见子部门
      await expect(
        page.getByRole("treeitem", { name: childName })
      ).toBeVisible();

      // 搜索过滤：仅命中部门及其祖先可见
      await page.getByRole("searchbox", { name: "搜索部门" }).fill(childName);
      await expect(
        page.getByRole("treeitem", { name: childName })
      ).toBeVisible();
      await page
        .getByRole("searchbox", { name: "搜索部门" })
        .fill("绝对不存在的部门");
      await expect(page.getByText("没有匹配的部门")).toBeVisible();
    });

    test("rejects duplicate sibling department names", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);

      const name = `重名部-${suffix}`;
      await createDepartmentViaApi(page, name);
      const response = await page.request.post("/api/management/organization", {
        data: { leaderId: null, name, parentId: null },
      });
      expect(response.status()).toBe(409);
      expect(await response.json()).toMatchObject({
        error: "同一上级部门下已存在同名部门",
      });
    });

    test("edits department name and leader", async ({ page }) => {
      const suffix = uniqueSuffix();
      const email = await registerAccount(page);
      const rootName = `集团-${suffix}`;
      await createDepartmentViaApi(page, rootName);

      await page.goto(ORGANIZATION_URL);
      await page.getByRole("treeitem", { name: rootName }).click();
      await page.getByRole("button", { name: "编辑部门" }).click();

      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "编辑部门" })
      ).toBeVisible();
      // 顶级部门不支持调整上级
      await expect(dialog.locator("#department-parent")).toBeDisabled();
      await expect(
        dialog.getByText("顶级组织不支持调整上级部门")
      ).toBeVisible();

      const renamed = `集团改-${suffix}`;
      await dialog.getByLabel("部门名称").fill(renamed);
      await dialog.locator("#department-leader").click();
      await page.getByRole("option", { name: email.split("@")[0] }).click();
      await dialog.getByRole("button", { name: "保存更改" }).click();

      await expect(page.getByText(`已更新部门「${renamed}」`)).toBeVisible();
      await expect(page.getByRole("treeitem", { name: renamed })).toBeVisible();
      await expect(page.getByRole("heading", { name: renamed })).toBeVisible();
      // 详情面板负责人显示当前登录成员（注册账号未设置姓名，展示邮箱前缀）
      await expect(
        page.getByText(email.split("@")[0], { exact: true }).first()
      ).toBeVisible();
    });

    test("blocks deleting a department that has children", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);
      const rootName = `父部门-${suffix}`;
      const childName = `子部门-${suffix}`;
      const root = await createDepartmentViaApi(page, rootName);
      await createDepartmentViaApi(page, childName, root.id);

      await page.goto(ORGANIZATION_URL);
      await page.getByRole("treeitem", { name: rootName }).click();
      await page.getByRole("button", { name: "编辑部门" }).click();

      const dialog = page.getByRole("dialog");
      // 存在下级部门时删除按钮禁用并给出提示
      await expect(
        dialog.getByRole("button", { name: "删除部门" })
      ).toBeDisabled();
      await expect(dialog.getByText("该部门下还有 1 个下级部门")).toBeVisible();

      // 接口同样拒绝删除有下级部门的部门
      const response = await page.request.delete(
        "/api/management/organization",
        {
          data: { id: root.id },
        }
      );
      expect(response.status()).toBe(409);
      expect(await response.json()).toMatchObject({
        error: "该部门下还有下级部门，需先删除或转移下级部门",
      });
    });

    test("deletes a leaf department after confirmation", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);
      const rootName = `保留部-${suffix}`;
      const childName = `待删部-${suffix}`;
      const root = await createDepartmentViaApi(page, rootName);
      await createDepartmentViaApi(page, childName, root.id);

      await page.goto(ORGANIZATION_URL);
      await page.getByRole("treeitem", { name: childName }).click();
      await page.getByRole("button", { name: "编辑部门" }).click();

      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "删除部门" }).click();

      const alert = page.getByRole("alertdialog");
      await expect(alert.getByText("删除部门？")).toBeVisible();
      // 取消不删除
      await alert.getByRole("button", { name: "取消" }).click();
      await expect(
        page.getByRole("treeitem", { name: childName })
      ).toBeVisible();

      await page.getByRole("button", { name: "编辑部门" }).click();
      await dialog.getByRole("button", { name: "删除部门" }).click();
      await alert.getByRole("button", { exact: true, name: "删除" }).click();

      await expect(page.getByText(`已删除部门「${childName}」`)).toBeVisible();
      await expect(page.getByRole("treeitem", { name: childName })).toHaveCount(
        0
      );
      // 删除后选中回退到上级部门
      await expect(page.getByRole("heading", { name: rootName })).toBeVisible();
    });

    test("shows assigned members in department details", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);
      const departmentName = `人事部-${suffix}`;
      const department = await createDepartmentViaApi(page, departmentName);
      await createMemberViaApi(page, {
        departmentId: department.id,
        email: `org-member-${suffix}@company.com`,
        name: "陈归属",
      });

      await page.goto(ORGANIZATION_URL);
      await page.getByRole("treeitem", { name: departmentName }).click();

      await expect(
        page.getByRole("heading", { name: departmentName })
      ).toBeVisible();
      // 成员数量按子树统计，直属成员计数与成员卡片同步展示
      await expect(page.getByText("1 人")).toBeVisible();
      await expect(page.getByText("直属 1 名成员")).toBeVisible();
      await expect(page.getByText("陈归属", { exact: true })).toBeVisible();
    });
  });
