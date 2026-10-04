import { rm } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { cleanupTestData } from "./helpers/test-cleanup";

test("members can edit their profile and password without management access", async ({
  page,
  browser,
}) => {
  const username = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${username}@test.local`;
  const otherEmail = `other-${username}@test.local`;
  const avatarSql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  try {
    await page.goto("/register");
    await page.locator("#email:visible").fill(email);
    await page.locator("#password:visible").fill("test123456");
    await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
    await page.waitForURL("/");
    await page.locator('[data-testid="user-nav-button"]:visible').click();
    await expect(page.getByTestId("user-nav-item-admin")).toHaveCount(0);
    await page.getByTestId("user-nav-item-profile").click();
    await expect(page).toHaveURL("/settings/profile");
    await expect(
      page.getByRole("heading", { name: /^(个人资料|Personal profile)$/ })
    ).toBeVisible();
    await expect(page.getByText(email, { exact: true }).first()).toBeVisible();
    const profileMain = page.locator("main:visible");
    await expect(
      profileMain.getByText(/^(角色|Role)$/, { exact: true })
    ).toBeVisible();
    await expect(
      profileMain.getByText(/^(所在部门|Department)$/, { exact: true })
    ).toBeVisible();
    await expect(
      profileMain.getByText(/^(累计任务数|Total tasks)$/, { exact: true })
    ).toHaveCount(0);
    await expect(
      profileMain.getByRole("heading", { name: /^(最近任务|Recent tasks)$/ })
    ).toHaveCount(0);

    await page.screenshot({
      fullPage: true,
      path: "/tmp/piwork-profile-desktop.png",
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(
      page.getByRole("heading", { name: /^(个人资料|Personal profile)$/ })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      fullPage: true,
      path: "/tmp/piwork-profile-mobile.png",
    });
    await page.setViewportSize({ height: 800, width: 1280 });
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTbkAAAAASUVORK5CYII=",
      "base64"
    );
    await page.getByLabel(/^(更换头像|Change avatar)$/).setInputFiles({
      buffer: png,
      mimeType: "image/png",
      name: "avatar.png",
    });
    await expect(page.getByRole("status")).toHaveText(
      /保存成功|Saved successfully/
    );
    await expect(
      page.getByRole("img", { name: /^(头像|Avatar)$/ })
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("img", { name: /^(头像|Avatar)$/ })
    ).toBeVisible();
    const avatarUrl = await page
      .getByRole("img", { name: /^(头像|Avatar)$/ })
      .getAttribute("src");
    expect((await page.request.get(avatarUrl ?? "")).status()).toBe(200);
    const otherContext = await browser.newContext();
    try {
      const otherPage = await otherContext.newPage();
      await otherPage.goto(new URL("/register", page.url()).toString());
      await otherPage.locator("#email:visible").fill(otherEmail);
      await otherPage.locator("#password:visible").fill("test123456");
      await otherPage.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
      await otherPage.waitForURL(new URL("/", page.url()).toString());
      expect(
        (
          await otherContext.request.get(
            new URL(avatarUrl ?? "", page.url()).toString()
          )
        ).status()
      ).toBe(404);
    } finally {
      await otherContext.close();
    }

    const invalidUpload = await page.request.post("/api/profile/avatar", {
      multipart: {
        file: {
          buffer: Buffer.from("not an image"),
          mimeType: "image/png",
          name: "fake.png",
        },
      },
    });
    expect(invalidUpload.status()).toBe(400);
    await page.getByRole("button", { name: /^(编辑|Edit)$/ }).click();
    await page.locator("#name:visible").fill("Profile Test User");
    await page.getByRole("button", { name: /^(保存|Save)$/ }).click();
    await expect(page.getByRole("status")).toHaveText(
      /保存成功|Saved successfully/
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Profile Test User" })
    ).toBeVisible();
    const activityChatId = crypto.randomUUID();
    await avatarSql`insert into "Chat" (id, "userId", title, "createdAt", visibility) select ${activityChatId}, id, 'Heatmap fixture', now(), 'private' from "User" where email = ${email}`;
    const [usageRun] =
      await avatarSql`insert into "AgentRun" ("chatId", "userId", status, "createdAt") select ${activityChatId}, id, 'settled', now() from "User" where email = ${email} returning id`;
    await avatarSql`insert into "RuntimeEvent" ("runId", seq, type, data) values (${usageRun.id}, 1, 'message.completed', ${avatarSql.json({ usage: { cacheRead: 0, cacheWrite: 0, input: 1, output: 2, totalTokens: 21_210_000 } })})`;
    await avatarSql`insert into "AgentRun" ("chatId", "userId", status, "createdAt") select ${activityChatId}, id, 'settled', current_date - interval '1 day' from "User" where email = ${email}`;
    await page.getByRole("link", { name: /^(用量统计|Usage)$/ }).click();
    await expect(page).toHaveURL("/settings/usage");
    await expect(
      page.getByRole("heading", { name: /^(Token 活动|Token activity)$/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^(最近任务|Recent tasks)$/ })
    ).toHaveCount(0);
    const [today] =
      await avatarSql`select to_char(current_date, 'YYYY-MM-DD') as date`;
    const todayCell = page.locator(
      `main:visible button[data-date="${today.date}"]`
    );
    await expect(todayCell).toBeVisible();
    await todayCell.hover();
    await expect(page.getByRole("tooltip")).toContainText(
      /(2121万|21.21M) Token/
    );
    await page
      .getByRole("heading", { name: /^(Token 活动|Token activity)$/ })
      .hover();
    const [yesterday] =
      await avatarSql`select to_char(current_date - interval '1 day', 'YYYY-MM-DD') as date`;
    await page
      .locator(`main:visible button[data-date="${yesterday.date}"]`)
      .hover();
    await expect(page.getByRole("tooltip")).toContainText(
      /(未记录 Token 用量|Token usage was not recorded)/
    );
    await page
      .getByRole("heading", { name: /^(Token 活动|Token activity)$/ })
      .hover();
    await page.setViewportSize({ height: 900, width: 1920 });
    for (const section of ["profile", "security", "usage"]) {
      // biome-ignore lint/performance/noAwaitInLoops: Shared browser page requires sequential navigation.
      await page.goto(`/settings/${section}`);
      await expect(page.locator("main:visible > div")).toHaveCSS(
        "max-width",
        "960px"
      );
      const box = await page.locator("main:visible > div").boundingBox();
      expect(box?.width).toBe(960);
    }
    await page.getByRole("button", { name: /^(每周|Weekly)$/ }).click();
    await expect(
      page.getByRole("button", { name: /^(每周|Weekly)$/ })
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^(累计|Cumulative)$/ }).click();
    await expect(
      page.getByRole("button", { name: /^(累计|Cumulative)$/ })
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      fullPage: true,
      path: "/tmp/piwork-usage-desktop.png",
    });
    await page.setViewportSize({ height: 844, width: 390 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      fullPage: true,
      path: "/tmp/piwork-usage-mobile.png",
    });
    await page.setViewportSize({ height: 800, width: 1280 });

    await expect(
      page
        .locator("main:visible")
        .getByText(/^(累计 Token 数|Total tokens)$/, { exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /^(用量统计|Usage)$/ })
    ).toBeVisible();
    await page
      .getByRole("link", { name: /^(个人资料|Personal profile)$/ })
      .click();
    await expect(page).toHaveURL("/settings/profile");
    await page.getByRole("link", { name: /^(账号密码|Password)$/ }).click();
    await expect(page).toHaveURL("/settings/security");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /^(账号密码|Password)$/ })
    ).toBeVisible();

    await page.locator("#current:visible").fill("incorrect");
    await page.locator("#new:visible").fill("changed123456");
    await page.locator("#confirm:visible").fill("changed123456");
    await page.getByRole("button", { name: /^(保存|Save)$/ }).click();
    await expect(page.getByRole("status")).toHaveText(
      /当前密码不正确|Current password is incorrect/
    );
    await page.locator("#current:visible").fill("test123456");
    await page.getByRole("button", { name: /^(保存|Save)$/ }).click();
    await expect(page.getByRole("status")).toHaveText(
      /保存成功|Saved successfully/
    );
    await page.goto("/admin");
    await expect(page).toHaveURL("/settings/profile");
    expect((await page.request.get("/api/admin/members")).status()).toBe(401);
    await page.goto("/");
    await expect(page.locator('[data-testid="user-email"]:visible')).toHaveText(
      "Profile Test User"
    );
    await expect(
      page
        .getByTestId("user-nav-button")
        .getByRole("img", { exact: true, name: "Profile Test User" })
    ).toBeVisible();
    await page.goto("/settings/profile");
    await page
      .getByRole("button", { name: /^(恢复默认头像|Reset avatar)$/ })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      /保存成功|Saved successfully/
    );
    await expect(
      page.getByRole("img", { name: /^(头像|Avatar)$/ })
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("img", { name: /^(头像|Avatar)$/ })
    ).toHaveCount(0);
    await page.goto("/");
    await page.locator('[data-testid="user-nav-button"]:visible').click();
    await page.getByTestId("user-nav-item-auth").click();
    await page.waitForURL("/login");
    await page.locator("#email:visible").fill(email);
    await page.locator("#password:visible").fill("changed123456");
    await page.getByRole("button", { name: /^(登录|Sign in)$/ }).click();
    await page.waitForURL("/");
    await expect(page.locator('[data-testid="user-email"]:visible')).toHaveText(
      "Profile Test User"
    );
  } finally {
    const files =
      await avatarSql`select "url" from "LibraryItem" where "userId" = (select id from "User" where email = ${email})`;
    await Promise.all(
      files
        .filter((file) => file.url?.startsWith("/api/files/"))
        .map(async (file) => {
          const filename = path.basename(file.url);
          const directory = process.env.UPLOAD_DIR || ".uploads";
          await rm(path.join(directory, filename), { force: true });
          await rm(path.join(directory, `${filename}.json`), { force: true });
        })
    );
    await avatarSql`delete from "LibraryItem" where "userId" in (select id from "User" where email = any(${[email, otherEmail]}))`;
    await cleanupTestData({ emailPatterns: [email, otherEmail] });
    await avatarSql.end();
  }
});

test("enabled administrators retain both profile and management entries", async ({
  page,
}) => {
  const email = `profile-admin-${crypto.randomUUID().slice(0, 8)}@test.local`;
  const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  try {
    await page.goto("/register");
    await page.locator("#email:visible").fill(email);
    await page.locator("#password:visible").fill("test123456");
    await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
    await page.waitForURL("/");
    await sql`update "Member" set role = 'admin' where "userId" = (select id from "User" where email = ${email})`;
    await page.reload();
    await page.locator('[data-testid="user-nav-button"]:visible').click();
    await expect(page.getByTestId("user-nav-item-profile")).toBeVisible();
    await expect(page.getByTestId("user-nav-item-admin")).toBeVisible();
    await page.getByTestId("user-nav-item-admin").click();
    await expect(page).toHaveURL("/admin");
    expect((await page.request.get("/api/admin/members")).status()).toBe(200);
  } finally {
    await cleanupTestData({ emailPatterns: [email] });
    await sql.end();
  }
});
