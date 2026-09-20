import { expect, test } from "@playwright/test";

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
