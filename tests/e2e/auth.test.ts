import { expect, test } from "@playwright/test";
import { cleanupTestData } from "./helpers/test-cleanup";

test("signing out replaces the account identity with the login prompt", async ({
  page,
}) => {
  const username = `logout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${username}@test.local`;
  try {
    await page.goto("/register");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("test123456");
    await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
    await page.waitForURL("/");
    await expect(page.getByTestId("user-email")).toHaveText(username);
    await page.getByTestId("user-nav-button").click();
    await page.getByTestId("user-nav-item-auth").click();
    await expect(page.getByTestId("user-email")).toHaveText(
      /^(登录账户|Log in to your account)$/
    );
    const session = await page.request.get("/api/auth/session");
    expect((await session.json()).user.type).toBe("guest");
    await page.reload();
    await expect(page.getByTestId("user-email")).toHaveText(
      /^(登录账户|Log in to your account)$/
    );
    await page.getByTestId("user-nav-button").click();
    await expect(page.getByTestId("user-nav-item-admin")).toHaveCount(0);
    await page.getByTestId("user-nav-item-auth").click();
    await expect(page).toHaveURL("/login");
  } finally {
    await cleanupTestData({ emailPatterns: [email] });
  }
});

test.describe("Authentication Pages", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /^(欢迎回来|Welcome back)$/ })
    ).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^(登录|Sign in)$/ })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(注册|Sign up)$/ })
    ).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: /^(创建账户|Create account)$/ })
    ).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^(注册|Sign up)$/ })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/ })
    ).toBeVisible();
  });

  test("can navigate from login to register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /^(注册|Sign up)$/ }).click();
    await expect(page).toHaveURL("/register");
  });

  test("can navigate from register to login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: /^(登录|Sign in)$/ }).click();
    await expect(page).toHaveURL("/login");
  });
});
