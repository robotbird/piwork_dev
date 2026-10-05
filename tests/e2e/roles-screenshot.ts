import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { cleanupTestData } from "./helpers/test-cleanup";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = "artifacts/role-screens";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    // 语言随 Accept-Language 协商，固定为中文与设计稿一致
    locale: "zh-CN",
    viewport: { height: 900, width: 1440 },
  });

  // 注册独立账号（登录时自动补建成员记录），避免依赖数据库既有数据
  const email = `roles-shot-${Date.now()}@test.local`;
  await page.goto(`${BASE_URL}/register`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("test123456");
  await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    { timeout: 30_000 }
  );

  // 角色与权限页列表
  await page.goto(`${BASE_URL}/admin/organization?view=permissions`);
  await page.getByRole("heading", { name: "角色与权限" }).waitFor();
  await page.getByRole("table").waitFor(); // 等待客户端水合完成后再交互

  // 造一个自定义角色，让列表同时展示「系统 / 自定义」两种徽章
  // 头部按钮文案走 legacy key 映射，两种叫法都兼容
  await page.getByRole("button", { name: /^(新建角色|创建角色)$/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#role-name").fill("Skill 开发者");
  await dialog.locator("#role-description").fill("可创建、管理和发布 Skill");
  await dialog.getByRole("button", { name: "创建角色" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.screenshot({ path: `${OUT_DIR}/roles-list.png` });

  // 系统角色详情弹窗（超级管理员：单成员、成员上限 1 人），经「⋯」菜单打开
  await page.getByRole("button", { name: /^超级管理员\s/ }).click();
  await page.getByRole("button", { exact: true, name: "管理成员" }).click();
  await dialog.getByRole("heading", { name: /超级管理员/ }).waitFor();
  await page.screenshot({ path: `${OUT_DIR}/role-members.png` });

  // 成员选择面板（超级管理员为单选替换模式）
  await dialog.getByRole("button", { name: "选择成员" }).click();
  await dialog.getByRole("searchbox", { name: "搜索成员" }).waitFor();
  await page.screenshot({ path: `${OUT_DIR}/role-picker.png` });

  await browser.close();

  // 截图完成后清理注册的账号与创建的自定义角色，保持开发库干净
  await cleanupTestData({
    emailPatterns: ["roles-shot-%@test.local"],
    rolePatterns: ["Skill 开发者%"],
  });
  console.log(`screenshots saved to ${OUT_DIR}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
