import { expect, type Page, test } from "@playwright/test";

const MEMBER_URL = "/management/organization?view=members";

/** 每个用例注册独立账号，避免用例间成员状态互相影响 */
async function signInWithFreshAccount(page: Page) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto("/register");
  // 注册页文案跟随语言偏好（默认中文），用稳定的字段 id 与双语按钮匹配
  await page.locator("#email").fill(`members-e2e-${suffix}@test.local`);
  await page.locator("#password").fill("test123456");
  await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
  // 注册成功后 (auth) 布局会把已登录用户重定向回应用首页
  // （重定向可能先于等待发生，用 waitForFunction 轮询当前地址而不是等导航事件）
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    { timeout: 30_000 }
  );
}

/** 按姓名精确定位成员行，避免「张三」误匹配「张三丰」等前缀重叠的姓名 */
function memberRow(page: Page, name: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(name, { exact: true }) });
}

test.describe("Member Management", () => {
  test.beforeEach(async ({ page }) => {
    await signInWithFreshAccount(page);
    await page.goto(MEMBER_URL);
    await expect(page.getByRole("heading", { name: "成员管理" })).toBeVisible();
  });

  test("renders stats and seed members", async ({ page }) => {
    await expect(page.getByTestId("member-count-total")).toHaveText("24");
    await expect(page.getByTestId("member-count-enabled")).toHaveText("21");
    await expect(page.getByTestId("member-count-disabled")).toHaveText("3");

    await expect(memberRow(page, "王小明")).toBeVisible();
    await expect(memberRow(page, "赵六")).toContainText("未启用");
    await expect(memberRow(page, "王小明")).toContainText("管理员");
  });

  test("filters members by keyword", async ({ page }) => {
    const search = page.getByLabel("搜索成员");
    await search.fill("李华");
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
    await expect(memberRow(page, "李华")).toBeVisible();

    await search.fill("不存在的关键词");
    await expect(page.getByText("没有匹配的成员")).toBeVisible();

    await search.fill("技术部");
    // 种子数据中技术部成员：李华、陈七、吴静、林峰、马亮、唐磊、董轩
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(7);
  });

  test("adds a member with department and role", async ({ page }) => {
    await page.getByRole("button", { name: "添加成员" }).first().click();
    const dialog = page.getByRole("dialog");
    // 标题与提交按钮同名，用 heading 角色精确定位弹窗标题
    await expect(
      dialog.getByRole("heading", { name: "添加成员" })
    ).toBeVisible();

    await dialog.getByLabel("姓名").fill("测试用户");
    await dialog.getByLabel("邮箱").fill("tester@company.com");
    await dialog.locator("#member-department").click();
    await page.getByRole("option", { name: "设计部" }).click();
    await dialog.locator("#member-role").click();
    await page.getByRole("option", { name: "管理员" }).click();
    await dialog.getByRole("button", { name: "添加成员" }).click();

    await expect(page.getByText("已添加成员「测试用户」")).toBeVisible();
    const row = memberRow(page, "测试用户");
    await expect(row).toBeVisible();
    await expect(row).toContainText("tester@company.com");
    await expect(row).toContainText("设计部");
    await expect(row).toContainText("管理员");
    await expect(page.getByTestId("member-count-total")).toHaveText("25");
    await expect(page.getByTestId("member-count-enabled")).toHaveText("22");
  });

  test("rejects duplicated email when adding", async ({ page }) => {
    await page.getByRole("button", { name: "添加成员" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("姓名").fill("重复邮箱");
    await dialog.getByLabel("邮箱").fill("lihua@company.com");
    await dialog.getByRole("button", { name: "添加成员" }).click();

    await expect(dialog.getByText("该邮箱已被其他成员使用")).toBeVisible();
    await expect(page.getByTestId("member-count-total")).toHaveText("24");
  });

  test("edits a member", async ({ page }) => {
    await memberRow(page, "张三")
      .getByRole("button", { name: "编辑成员 张三" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "编辑成员" })
    ).toBeVisible();
    await dialog.getByLabel("姓名").fill("张三丰");
    await dialog.locator("#member-department").click();
    await page.getByRole("option", { name: "市场部" }).click();
    await dialog.getByRole("button", { name: "保存更改" }).click();

    await expect(page.getByText("已更新成员「张三丰」")).toBeVisible();
    const row = memberRow(page, "张三丰");
    await expect(row).toBeVisible();
    await expect(row).toContainText("市场部");
    await expect(memberRow(page, "张三")).toHaveCount(0);
  });

  test("disables and re-enables a member", async ({ page }) => {
    const row = memberRow(page, "李华");
    await row.getByRole("button", { name: "停用成员 李华" }).click();

    await expect(page.getByText("已停用「李华」")).toBeVisible();
    await expect(row).toContainText("未启用");
    await expect(page.getByTestId("member-count-enabled")).toHaveText("20");
    await expect(page.getByTestId("member-count-disabled")).toHaveText("4");

    await row.getByRole("button", { name: "启用成员 李华" }).click();
    await expect(page.getByText("已启用「李华」")).toBeVisible();
    await expect(row).toContainText("已启用");
    await expect(page.getByTestId("member-count-enabled")).toHaveText("21");
  });

  test("deletes a member after confirmation", async ({ page }) => {
    await memberRow(page, "陈七")
      .getByRole("button", { name: "删除成员 陈七" })
      .click();

    const alert = page.getByRole("alertdialog");
    await expect(alert.getByText("删除成员？")).toBeVisible();
    await expect(alert).toContainText("chenqi@company.com");

    // 取消不删除
    await alert.getByRole("button", { name: "取消" }).click();
    await expect(memberRow(page, "陈七")).toBeVisible();

    await memberRow(page, "陈七")
      .getByRole("button", { name: "删除成员 陈七" })
      .click();
    await alert.getByRole("button", { name: "删除" }).click();

    await expect(page.getByText("已删除成员「陈七」")).toBeVisible();
    await expect(memberRow(page, "陈七")).toHaveCount(0);
    await expect(page.getByTestId("member-count-total")).toHaveText("23");
  });

  test("keeps at least one enabled admin", async ({ page }) => {
    // 先停用第二名管理员周婷，王小明成为唯一已启用管理员
    await memberRow(page, "周婷")
      .getByRole("button", { name: "停用成员 周婷" })
      .click();
    await expect(page.getByText("已停用「周婷」")).toBeVisible();

    const row = memberRow(page, "王小明");
    await row.getByRole("button", { name: "停用成员 王小明" }).click();
    await expect(
      page.getByText("需保留至少一名已启用的管理员，无法停用该成员")
    ).toBeVisible();
    await expect(row).toContainText("已启用");

    await row.getByRole("button", { name: "删除成员 王小明" }).click();
    await expect(
      page.getByText("需保留至少一名已启用的管理员，无法删除该成员")
    ).toBeVisible();
    await expect(row).toBeVisible();
  });

  test("blocks demoting the last enabled admin in dialog", async ({ page }) => {
    await memberRow(page, "周婷")
      .getByRole("button", { name: "停用成员 周婷" })
      .click();
    await expect(page.getByText("已停用「周婷」")).toBeVisible();

    await memberRow(page, "王小明")
      .getByRole("button", { name: "编辑成员 王小明" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#member-role").click();
    await page.getByRole("option", { name: "普通成员" }).click();
    await dialog.getByRole("button", { name: "保存更改" }).click();

    await expect(
      dialog.getByText("需保留至少一名已启用的管理员，无法降级或停用该成员")
    ).toBeVisible();
    // 模态框打开时页面其余部分被 aria-hidden，先关闭再校验表格数据未被降级
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(memberRow(page, "王小明")).toContainText("管理员");
  });
});
