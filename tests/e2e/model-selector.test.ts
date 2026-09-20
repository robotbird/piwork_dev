import { expect, test } from "@playwright/test";

// 当前模型选择器为紧凑样式：触发按钮直接展示选中模型名，
// 弹出层无搜索框，列出 chatModels 中的模型（DeepSeek Flash / DeepSeek V4 Pro）。
test.describe("Model Selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays a model button", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await expect(modelButton).toBeVisible();
    // 按钮直接展示当前选中的模型名
    await expect(modelButton).toContainText(/DeepSeek/);
  });

  test("opens model selector popover on click", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await modelButton.click();

    await expect(
      page.getByRole("option", { name: /DeepSeek Flash/ })
    ).toBeVisible();
  });

  test("can close model selector with Escape", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await modelButton.click();

    const option = page.getByRole("option", { name: /DeepSeek Flash/ });
    await expect(option).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(option).toHaveCount(0);
  });

  test("shows curated models", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await modelButton.click();

    await expect(
      page.getByRole("option", { name: /DeepSeek Flash/ })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: /DeepSeek V4 Pro/ })
    ).toBeVisible();
  });

  test("can select a different model", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await modelButton.click();

    await page.getByRole("option", { name: /DeepSeek V4 Pro/ }).click();

    // 选择后弹出层关闭，按钮展示新选中的模型名
    await expect(
      page.getByRole("option", { name: /DeepSeek V4 Pro/ })
    ).toHaveCount(0);
    await expect(modelButton).toContainText("DeepSeek V4 Pro");
  });
});
