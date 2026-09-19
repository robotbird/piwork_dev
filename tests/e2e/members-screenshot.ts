import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = "artifacts/member-screens";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { height: 900, width: 1440 },
  });

  const email = `screenshot-${Date.now()}@test.local`;
  await page.goto(`${BASE_URL}/register`);
  // 注册页文案跟随语言偏好（默认中文），用稳定的字段 id 与双语按钮匹配
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("test123456");
  await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
  // 注册成功后 (auth) 布局会把已登录用户重定向回应用首页
  // （重定向可能先于等待发生，用 waitForFunction 轮询当前地址而不是等导航事件）
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    { timeout: 30_000 }
  );

  await page.goto(`${BASE_URL}/management/organization?view=members`);
  await page.getByRole("heading", { name: "成员管理" }).waitFor();

  // 打开添加成员弹窗，验证表单样式
  await page.screenshot({ path: `${OUT_DIR}/members-list.png` });
  await page.getByRole("table").waitFor(); // 等待客户端水合完成后再交互
  await page.getByRole("button", { name: "添加成员" }).first().click();
  // 标题与提交按钮同名，用 heading 角色精确定位弹窗标题
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: "添加成员" })
    .waitFor();
  await page.screenshot({ path: `${OUT_DIR}/members-dialog.png` });
  await page.keyboard.press("Escape");

  // 删除行操作确认框
  await page.getByRole("button", { name: "删除成员 陈七" }).click();
  await page.getByRole("alertdialog").getByText("删除成员？").waitFor();
  await page.screenshot({ path: `${OUT_DIR}/members-delete.png` });

  await browser.close();
  console.log(`screenshots saved to ${OUT_DIR}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
