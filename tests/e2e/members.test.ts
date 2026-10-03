import { expect, type Page, test } from "@playwright/test";
import { cleanupTestData } from "./helpers/test-cleanup";

const MEMBER_URL = "/admin/organization?view=members";
const DEFAULT_PASSWORD = "test123456";

/** 与页面/接口一致的成员视图（仅测试中用到的字段） */
type MemberView = {
  departmentId: string | null;
  email: string;
  id: string;
  name: string | null;
  role: "admin" | "member";
  status: "enabled" | "disabled";
  title: string | null;
  userId: string;
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 注册独立账号并等待跳转到应用首页；返回邮箱 */
async function registerAccount(page: Page): Promise<string> {
  const email = `members-e2e-${uniqueSuffix()}@test.local`;
  await page.goto("/register");
  // 注册页文案跟随语言偏好（默认中文），用稳定的字段 id 与双语按钮匹配
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
  // 注册成功后 (auth) 布局会把已登录用户重定向回应用首页
  // （重定向可能先于等待发生，用 waitForFunction 轮询当前地址而不是等导航事件）
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    { timeout: 30_000 }
  );
  return email;
}

/** 登录页提交凭据（成功登录后由 (auth) 布局重定向到应用首页） */
async function submitLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^(登录|Sign in)$/ }).click();
}

/** 通过管理接口读取成员列表（page.request 复用浏览器会话 Cookie） */
async function fetchMembers(page: Page): Promise<MemberView[]> {
  const response = await page.request.get("/api/admin/members");
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()) as { members: MemberView[] };
  return data.members;
}

/** 通过管理接口创建成员（含登录账号，可直接用邮箱登录） */
async function createMemberViaApi(
  page: Page,
  input: {
    departmentId?: string | null;
    email: string;
    name: string;
    password?: string;
    role?: "admin" | "member";
  }
): Promise<MemberView> {
  const response = await page.request.post("/api/admin/members", {
    data: {
      departmentId: input.departmentId ?? null,
      email: input.email,
      name: input.name,
      password: input.password ?? DEFAULT_PASSWORD,
      role: input.role ?? "member",
      title: null,
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as MemberView;
}

/** 通过管理接口更新成员（传入完整字段，覆盖不需要的保持原值） */
async function patchMemberViaApi(
  page: Page,
  member: MemberView,
  overrides: Partial<
    Pick<MemberView, "departmentId" | "name" | "role" | "status" | "title">
  >
) {
  const response = await page.request.patch("/api/admin/members", {
    data: {
      departmentId: overrides.departmentId ?? member.departmentId,
      id: member.id,
      name: overrides.name ?? member.name ?? member.email,
      role: overrides.role ?? member.role,
      status: overrides.status ?? member.status,
      title: overrides.title ?? member.title ?? null,
    },
  });
  return response;
}

/** 用邮箱前缀（注册账号无姓名时的展示名）精确定位成员行 */
function memberRowByEmail(page: Page, email: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(email, { exact: true }) });
}

/** 按姓名精确定位成员行，避免「张三」误匹配「张三丰」等前缀重叠的姓名 */
function memberRowByName(page: Page, name: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(name, { exact: true }) });
}

/** 在添加成员弹窗中填写并提交表单 */
async function fillMemberForm(
  page: Page,
  values: {
    departmentName?: string;
    email: string;
    name: string;
    password?: string;
    roleName?: string;
    title?: string;
  }
) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("姓名").fill(values.name);
  await dialog.getByLabel("邮箱").fill(values.email);
  if (values.title) {
    await dialog.getByLabel("职务").fill(values.title);
  }
  if (values.password) {
    await dialog.getByLabel("初始密码").fill(values.password);
  }
  await dialog.locator("#member-department").click();
  await page
    .getByRole("option", { name: values.departmentName ?? "未分配" })
    .click();
  await dialog.locator("#member-role").click();
  await page.getByRole("option", { name: values.roleName ?? "用户" }).click();
  await dialog.getByRole("button", { name: "添加成员" }).click();
}

test.describe
  .serial("Member Management", () => {
    // 语言随 Accept-Language 协商，固定为中文保证文案断言稳定
    test.use({ locale: "zh-CN" });

    // 用例结束后清理本套件注册的账号、创建的成员与部门，保持开发库干净
    test.afterAll(async () => {
      await cleanupTestData({
        departmentPatterns: ["研发部-%"],
        emailPatterns: [
          "members-e2e-%@test.local",
          "tester-%@company.com",
          "signin-%@company.com",
          "edit-%@company.com",
          "toggle-%@company.com",
          "remove-%@company.com",
          "last-admin-%@company.com",
        ],
      });
    });

    test("backfills the current account as a member on first login", async ({
      page,
    }) => {
      const email = await registerAccount(page);
      await page.goto(MEMBER_URL);
      await expect(
        page.getByRole("heading", { name: "成员管理" })
      ).toBeVisible();

      // 注册账号首次登录时自动补建成员记录：搜索自己即可看到唯一一行
      await page.getByRole("searchbox", { name: "搜索成员" }).fill(email);
      await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
      const row = memberRowByEmail(page, email);
      await expect(row).toContainText("（当前登录账号）");
      await expect(row).toContainText("已启用");
      await expect(row).toContainText("未分配");
    });

    test("adds a member with department and role", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);

      // 进入页面前先经接口创建部门，保证弹窗中的部门选项已包含它
      const departmentName = `研发部-${suffix}`;
      const departmentResponse = await page.request.post(
        "/api/admin/organization",
        {
          data: { leaderId: null, name: departmentName, parentId: null },
        }
      );
      expect(departmentResponse.ok()).toBeTruthy();

      await page.goto(MEMBER_URL);
      const memberEmail = `tester-${suffix}@company.com`;
      await page.getByRole("button", { name: "添加成员" }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "添加成员" })
      ).toBeVisible();

      await fillMemberForm(page, {
        departmentName,
        email: memberEmail,
        name: "张小测",
        password: "init-pass-123",
        roleName: "用户",
        title: "测试工程师",
      });

      await expect(page.getByText("已添加成员「张小测」")).toBeVisible();
      await page.getByRole("searchbox", { name: "搜索成员" }).fill(memberEmail);
      await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
      const row = memberRowByEmail(page, memberEmail);
      await expect(row).toContainText("张小测");
      await expect(row).toContainText(departmentName);
      await expect(row).toContainText("成员");
      await expect(row).toContainText("已启用");
    });

    test("created member can sign in with the initial password", async ({
      page,
    }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);

      // 通过接口创建成员（与弹窗创建等价，同一事务创建登录账号）
      const memberEmail = `signin-${suffix}@company.com`;
      await createMemberViaApi(page, {
        email: memberEmail,
        name: "李新号",
        password: "init-pass-456",
      });

      // 退出当前账号，用新成员的邮箱与初始密码登录
      await page.context().clearCookies();
      await submitLogin(page, memberEmail, "init-pass-456");
      await page.waitForFunction(
        () => window.location.pathname === "/",
        undefined,
        { timeout: 30_000 }
      );

      await page.goto(MEMBER_URL);
      await page.getByRole("searchbox", { name: "搜索成员" }).fill(memberEmail);
      await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
      await expect(memberRowByEmail(page, memberEmail)).toContainText(
        "（当前登录账号）"
      );
    });

    test("rejects duplicated email when adding", async ({ page }) => {
      const email = await registerAccount(page);
      await page.goto(MEMBER_URL);

      await page.getByRole("button", { name: "添加成员" }).first().click();
      const dialog = page.getByRole("dialog");
      await fillMemberForm(page, {
        email,
        name: "重复邮箱",
        password: "init-pass-123",
      });

      await expect(dialog.getByText("该邮箱已被其他成员使用")).toBeVisible();
    });

    test("edits a member", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);

      // 进入页面前先备好部门与成员，保证弹窗中的部门选项已包含它
      const departmentName = `市场部-${suffix}`;
      await page.request.post("/api/admin/organization", {
        data: { leaderId: null, name: departmentName, parentId: null },
      });

      const memberEmail = `edit-${suffix}@company.com`;
      await createMemberViaApi(page, { email: memberEmail, name: "王编辑" });

      await page.goto(MEMBER_URL);
      await page.getByRole("searchbox", { name: "搜索成员" }).fill(memberEmail);
      await memberRowByEmail(page, memberEmail)
        .getByRole("button", { name: "编辑成员 王编辑" })
        .click();

      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "编辑成员" })
      ).toBeVisible();
      await dialog.getByLabel("姓名").fill("王编辑改");
      await dialog.locator("#member-department").click();
      await page.getByRole("option", { name: departmentName }).click();
      await dialog.getByRole("button", { name: "保存更改" }).click();

      await expect(page.getByText("已更新成员「王编辑改」")).toBeVisible();
      const row = memberRowByEmail(page, memberEmail);
      await expect(row).toContainText("王编辑改");
      await expect(row).toContainText(departmentName);
    });

    test("disables and re-enables a member, and blocks disabled login", async ({
      page,
    }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);

      const memberEmail = `toggle-${suffix}@company.com`;
      const password = "init-pass-789";
      await createMemberViaApi(page, {
        email: memberEmail,
        name: "赵停用",
        password,
      });

      await page.goto(MEMBER_URL);
      await page.getByRole("searchbox", { name: "搜索成员" }).fill(memberEmail);
      const row = memberRowByEmail(page, memberEmail);
      await row.getByRole("button", { name: "停用成员 赵停用" }).click();

      await expect(page.getByText("已停用「赵停用」")).toBeVisible();
      await expect(row).toContainText("未启用");

      await row.getByRole("button", { name: "启用成员 赵停用" }).click();
      await expect(page.getByText("已启用「赵停用」")).toBeVisible();
      await expect(row).toContainText("已启用");

      // 再次停用后，被停用成员不允许登录，也无法进入管理控制台
      await row.getByRole("button", { name: "停用成员 赵停用" }).click();
      await expect(page.getByText("已停用「赵停用」")).toBeVisible();

      await page.context().clearCookies();
      await submitLogin(page, memberEmail, password);
      await expect(page.getByText("邮箱或密码错误！")).toBeVisible();
      await expect(page).toHaveURL(/\/login/);

      await page.goto(MEMBER_URL);
      await expect(page).toHaveURL(/\/login/);
    });

    test("deletes a member after confirmation", async ({ page }) => {
      const suffix = uniqueSuffix();
      await registerAccount(page);

      const memberEmail = `remove-${suffix}@company.com`;
      await createMemberViaApi(page, { email: memberEmail, name: "钱删除" });

      await page.goto(MEMBER_URL);
      await page.getByRole("searchbox", { name: "搜索成员" }).fill(memberEmail);
      await memberRowByEmail(page, memberEmail)
        .getByRole("button", { name: "删除成员 钱删除" })
        .click();

      const alert = page.getByRole("alertdialog");
      await expect(alert.getByText("删除成员？")).toBeVisible();
      await expect(alert).toContainText(memberEmail);

      // 取消不删除
      await alert.getByRole("button", { name: "取消" }).click();
      await expect(memberRowByEmail(page, memberEmail)).toBeVisible();

      await memberRowByEmail(page, memberEmail)
        .getByRole("button", { name: "删除成员 钱删除" })
        .click();
      await alert.getByRole("button", { exact: true, name: "删除" }).click();

      await expect(page.getByText("已删除成员「钱删除」")).toBeVisible();
      await expect(memberRowByEmail(page, memberEmail)).toHaveCount(0);
      await expect(page.getByText("没有匹配的成员")).toBeVisible();
    });

    test("protects the current account from disable and delete", async ({
      page,
    }) => {
      const email = await registerAccount(page);
      await page.goto(MEMBER_URL);

      await page.getByRole("searchbox", { name: "搜索成员" }).fill(email);
      const row = memberRowByEmail(page, email);
      const [displayName] = email.split("@");

      await row
        .getByRole("button", { name: `停用成员 ${displayName}` })
        .click();
      await expect(page.getByText("不能停用当前登录的账号")).toBeVisible();
      await expect(row).toContainText("已启用");

      await row
        .getByRole("button", { name: `删除成员 ${displayName}` })
        .click();
      await expect(page.getByText("不能删除当前登录的账号")).toBeVisible();
      await expect(row).toBeVisible();

      // 编辑自己时账号状态下拉被锁定
      await row
        .getByRole("button", { name: `编辑成员 ${displayName}` })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator("#member-status")).toBeDisabled();
      await expect(dialog.getByText("不能停用当前登录的账号")).toBeVisible();
    });

    test("keeps at least one enabled admin", async ({ page }) => {
      const email = await registerAccount(page);

      // 构造「仅剩一名已启用管理员」场景：
      // 1. 创建一名管理员 B；
      // 2. 若自己是管理员则先降级（B 存在，降级不受保护限制）；
      // 3. 停用其余所有已启用管理员（B 兜底，逐个停用不会被最后一名管理员保护拦截）。
      const memberB = await createMemberViaApi(page, {
        email: `last-admin-${uniqueSuffix()}@company.com`,
        name: "孙管理",
        role: "admin",
      });

      const members = await fetchMembers(page);
      const self = members.find((item) => item.email === email);
      expect(self).toBeDefined();
      if (self && self.role === "admin") {
        const response = await patchMemberViaApi(page, self, {
          role: "member",
        });
        expect(response.ok()).toBeTruthy();
      }

      const refreshed = await fetchMembers(page);
      const otherAdmins = refreshed.filter(
        (item) =>
          item.id !== memberB.id &&
          item.role === "admin" &&
          item.status === "enabled"
      );
      // 共享开发库中可能存在真实的已启用管理员（如开发者自己的账号），
      // 构造场景必须临时停用它们；快照原状并在 finally 中恢复，避免测试污染真实数据
      // （接口必填姓名，原姓名为空的账号恢复时会展名为邮箱，展示效果不变）
      const snapshots = otherAdmins.map((item) => ({
        departmentId: item.departmentId,
        item,
        name: item.name ?? undefined,
        role: item.role,
        status: item.status,
        title: item.title,
      }));
      // B 始终是已启用的管理员，并发停用其余管理员不会被最后一名管理员保护拦截
      const responses = await Promise.all(
        otherAdmins.map((item) =>
          patchMemberViaApi(page, item, { status: "disabled" })
        )
      );
      for (const response of responses) {
        expect(response.ok()).toBeTruthy();
      }

      try {
        await assertLastAdminProtections(page, memberB);
      } finally {
        await Promise.all(
          snapshots.map(({ item, ...restore }) =>
            patchMemberViaApi(page, item, restore)
          )
        );
      }
    });
  });

/** 「唯一已启用的管理员」场景下的界面保护断言（成员 B 不可停用/删除/降级） */
async function assertLastAdminProtections(page: Page, memberB: MemberView) {
  // 重新进入页面拿到最新成员状态，B 成为唯一已启用的管理员
  await page.goto(MEMBER_URL);
  await page.getByRole("searchbox", { name: "搜索成员" }).fill(memberB.email);
  const row = memberRowByEmail(page, memberB.email);

  await row.getByRole("button", { name: "停用成员 孙管理" }).click();
  await expect(
    page.getByText("需保留至少一名已启用的管理员，无法停用该成员")
  ).toBeVisible();
  await expect(row).toContainText("已启用");

  await row.getByRole("button", { name: "删除成员 孙管理" }).click();
  await expect(
    page.getByText("需保留至少一名已启用的管理员，无法删除该成员")
  ).toBeVisible();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "编辑成员 孙管理" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#member-role").click();
  await page.getByRole("option", { name: "用户" }).click();
  await dialog.getByRole("button", { name: "保存更改" }).click();
  await expect(
    dialog.getByText("需保留至少一名已启用的管理员，无法降级或停用该成员")
  ).toBeVisible();
  // 模态框打开时页面其余部分被 aria-hidden，先关闭再校验表格数据未被降级
  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(memberRowByName(page, "孙管理")).toContainText("管理员");
}
