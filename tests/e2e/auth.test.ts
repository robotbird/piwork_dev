import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { cleanupTestData } from "./helpers/test-cleanup";

test("signing out requires login and does not create a guest session", async ({
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
    await expect(page).toHaveURL("/login");
    const session = await page.request.get("/api/auth/session");
    expect(await session.json()).toBeNull();
    await page.goto("/");
    await expect(page).toHaveURL("/login");
    await page.goto("/api/auth/guest");
    await expect(page).toHaveURL("/login");
    const providers = await page.request.get("/api/auth/providers");
    expect(await providers.json()).not.toHaveProperty("guest");
    expect((await page.request.get("/api/projects")).status()).toBe(401);
  } finally {
    await cleanupTestData({ emailPatterns: [email] });
  }
});

test.describe("Authentication Pages", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /^(欢迎登录|Welcome back)$/ })
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

test("legacy guest sessions cannot access the app or business APIs", async ({
  page,
  context,
}) => {
  const token = await encode({
    salt: "authjs.session-token",
    secret: process.env.AUTH_SECRET ?? "",
    token: { email: "guest-123456", id: crypto.randomUUID(), type: "guest" },
  });
  await context.addCookies([
    {
      domain: "localhost",
      httpOnly: true,
      name: "authjs.session-token",
      path: "/",
      sameSite: "Lax",
      value: token,
    },
  ]);
  await page.goto("/");
  await expect(page).toHaveURL("/login");
  expect((await page.request.get("/api/projects")).status()).toBe(401);
  expect(await (await page.request.get("/api/auth/session")).json()).toBeNull();
});
