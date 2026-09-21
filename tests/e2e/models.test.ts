import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { cleanupTestData } from "./helpers/test-cleanup";

const MODELS_URL = "/management/models";
const DEFAULT_PASSWORD = "test123456";

/** 与接口一致的供应商视图（仅测试中用到的字段） */
type ProviderSummary = {
  createdAt: string;
  description: string | null;
  enabled: boolean;
  id: string;
  modelCount: number;
  name: string;
  protocol: "openai-compatible";
};

type ModelItem = {
  createdAt: string;
  enabled: boolean;
  id: string;
  isDefault: boolean;
  modelId: string;
  name: string;
  type: "chat" | "multimodal";
};

type ProviderDetail = ProviderSummary & {
  apiKey: string;
  baseUrl: string;
  models: ModelItem[];
  updatedAt: string;
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 模型管理为管理员专属功能，注册后直接在库内把该账号提升为管理员 */
async function promoteToAdmin(email: string): Promise<void> {
  const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  try {
    await sql`UPDATE "Member" SET "role" = 'admin'
      WHERE "userId" = (SELECT "id" FROM "User" WHERE "email" = ${email})`;
  } finally {
    await sql.end();
  }
}

/** 注册独立账号并等待跳转到应用首页；返回邮箱 */
async function registerAccount(page: Page): Promise<string> {
  const email = `models-e2e-${uniqueSuffix()}@test.local`;
  await page.goto("/register");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: /^(注册|Sign up)$/ }).click();
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    { timeout: 30_000 }
  );
  return email;
}

async function fetchProviders(page: Page): Promise<ProviderSummary[]> {
  const response = await page.request.get("/api/management/models");
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()) as { providers: ProviderSummary[] };
  return data.providers;
}

/** 通过接口创建供应商，返回列表视图中的记录 */
async function createProviderViaApi(
  page: Page,
  input: {
    apiKey?: string;
    baseUrl?: string;
    description?: string | null;
    name: string;
  }
): Promise<ProviderSummary> {
  const response = await page.request.post("/api/management/models", {
    data: {
      apiKey: input.apiKey ?? "sk-test-key",
      baseUrl: input.baseUrl ?? "https://api.example.com/v1",
      description: input.description ?? null,
      name: input.name,
    },
  });
  expect(response.status()).toBe(201);
  const providers = await fetchProviders(page);
  const created = providers.find((item) => item.name === input.name);
  if (!created) {
    throw new Error(`Provider not found after create: ${input.name}`);
  }
  return created;
}

/** 在供应商下添加模型（走接口），返回详情视图 */
async function addModelViaApi(
  page: Page,
  providerId: string,
  input: {
    isDefault?: boolean;
    modelId: string;
    name: string;
    type?: "chat" | "multimodal";
  }
): Promise<ProviderDetail> {
  const response = await page.request.post(
    `/api/management/models/${providerId}/models`,
    {
      data: {
        isDefault: input.isDefault ?? false,
        modelId: input.modelId,
        name: input.name,
        type: input.type ?? "chat",
      },
    }
  );
  expect(response.status()).toBe(201);
  return (await response.json()) as ProviderDetail;
}

/** 用真实 http 服务模拟 OpenAI 兼容接口，验证测试连通性的成功路径 */
async function startMockOpenAiServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const { Server } = await import("node:http");
  const server = new Server((req, res) => {
    if (req.url?.endsWith("/chat/completions")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: "pong" } }],
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Failed to start mock server");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  };
}

test.describe
  .serial("Model Management", () => {
    // 语言随 Accept-Language 协商，固定为中文保证文案断言稳定
    test.use({ locale: "zh-CN" });

    // 用例结束后清理本套件注册的账号与创建的供应商（其下模型级联删除）
    test.afterAll(async () => {
      await cleanupTestData({
        emailPatterns: ["models-e2e-%@test.local"],
        providerPatterns: ["测试供应商%", "E2E 供应商%", "验收供应商%"],
      });
    });

    test("renders the provider list page for admins only", async ({ page }) => {
      const email = await registerAccount(page);

      // 普通成员只能看到权限说明，不暴露供应商数据与操作
      await page.goto(MODELS_URL);
      await expect(
        page.getByRole("heading", { name: "模型管理" })
      ).toBeVisible();
      // 流式 SSR 期间隐藏的 suspense 副本会短暂并存，取第一个匹配避免严格模式冲突
      await expect(
        page.getByText(/模型管理仅管理员可用/).first()
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /添加模型供应商/ })
      ).toHaveCount(0);

      // 提升为管理员后看到真实的供应商列表
      await promoteToAdmin(email);
      await page.goto(MODELS_URL);
      await expect(
        page.getByRole("heading", { name: "模型管理" })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /添加模型供应商/ })
      ).toBeVisible();
    });

    test("validates provider input and duplicates", async ({ page }) => {
      const email = await registerAccount(page);
      await promoteToAdmin(email);

      const name = `E2E 供应商 ${uniqueSuffix()}`;
      const created = await createProviderViaApi(page, { name });
      expect(created.enabled).toBe(true);
      expect(created.modelCount).toBe(0);
      expect(created.protocol).toBe("openai-compatible");

      // 同名供应商返回 409
      const duplicate = await page.request.post("/api/management/models", {
        data: {
          apiKey: "sk-test-key",
          baseUrl: "https://api.example.com/v1",
          name,
        },
      });
      expect(duplicate.status()).toBe(409);

      // 非法 Base URL 返回 400
      const invalidUrl = await page.request.post("/api/management/models", {
        data: {
          apiKey: "sk-test-key",
          baseUrl: "not-a-url",
          name: `${name} 非法`,
        },
      });
      expect(invalidUrl.status()).toBe(400);

      // 缺少 API Key 返回 400
      const missingKey = await page.request.post("/api/management/models", {
        data: { baseUrl: "https://api.example.com/v1", name: `${name} 无密钥` },
      });
      expect(missingKey.status()).toBe(400);
    });

    test("manages models, default flag and provider lifecycle", async ({
      page,
    }) => {
      const email = await registerAccount(page);
      await promoteToAdmin(email);
      const provider = await createProviderViaApi(page, {
        description: "E2E 校验用供应商",
        name: `E2E 供应商 ${uniqueSuffix()}`,
      });

      // 添加两个模型，第二个设为默认
      let detail = await addModelViaApi(page, provider.id, {
        modelId: "test-mini",
        name: "测试 Mini",
      });
      expect(detail.models).toHaveLength(1);

      detail = await addModelViaApi(page, provider.id, {
        isDefault: true,
        modelId: "test-pro",
        name: "测试 Pro",
      });
      expect(detail.models).toHaveLength(2);
      const pro = detail.models.find((model) => model.modelId === "test-pro");
      expect(pro?.isDefault).toBe(true);

      // 同一供应商下重复 Model ID 返回 409
      const duplicateModel = await page.request.post(
        `/api/management/models/${provider.id}/models`,
        {
          data: { modelId: "test-pro", name: "重复模型", type: "chat" },
        }
      );
      expect(duplicateModel.status()).toBe(409);

      // 停用默认模型后默认标记自动取消
      const disableDefault = await page.request.patch(
        `/api/management/models/${provider.id}/models`,
        { data: { enabled: false, id: pro?.id } }
      );
      expect(disableDefault.ok()).toBeTruthy();
      detail = (await disableDefault.json()) as ProviderDetail;
      expect(
        detail.models.find((model) => model.id === pro?.id)?.isDefault
      ).toBe(false);

      // 已停用的模型不能直接设为默认
      const defaultOnDisabled = await page.request.patch(
        `/api/management/models/${provider.id}/models`,
        { data: { id: pro?.id, isDefault: true } }
      );
      expect(defaultOnDisabled.status()).toBe(400);

      // 重新启用后可设为默认，且替换既有默认
      await page.request.patch(`/api/management/models/${provider.id}/models`, {
        data: { enabled: true, id: pro?.id },
      });
      const setDefault = await page.request.patch(
        `/api/management/models/${provider.id}/models`,
        { data: { id: pro?.id, isDefault: true } }
      );
      expect(setDefault.ok()).toBeTruthy();
      detail = (await setDefault.json()) as ProviderDetail;
      const defaults = detail.models.filter((model) => model.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0]?.id).toBe(pro?.id);

      // 重命名供应商与留空保留 API Key
      const renamed = await page.request.patch(
        `/api/management/models/${provider.id}`,
        {
          data: {
            apiKey: "",
            description: "更新后的描述",
            name: `${provider.name} 改名`,
          },
        }
      );
      expect(renamed.ok()).toBeTruthy();
      detail = (await renamed.json()) as ProviderDetail;
      expect(detail.name).toBe(`${provider.name} 改名`);
      expect(detail.apiKey).toBe("sk-test-key");

      // 停用供应商会取消其下默认模型
      const disabled = await page.request.patch(
        `/api/management/models/${provider.id}`,
        { data: { enabled: false } }
      );
      expect(disabled.ok()).toBeTruthy();
      detail = (await disabled.json()) as ProviderDetail;
      expect(detail.models.every((model) => !model.isDefault)).toBe(true);

      // 删除供应商后详情 404，模型随级联删除
      const removed = await page.request.delete(
        `/api/management/models/${provider.id}`
      );
      expect(removed.ok()).toBeTruthy();
      const missing = await page.request.get(
        `/api/management/models/${provider.id}`
      );
      expect(missing.status()).toBe(404);
    });

    test("creates provider and model from the UI and tests connectivity", async ({
      page,
    }) => {
      const mockServer = await startMockOpenAiServer();
      try {
        const email = await registerAccount(page);
        await promoteToAdmin(email);
        await page.goto(MODELS_URL);

        const providerName = `验收供应商 ${uniqueSuffix()}`;

        // 通过弹窗创建供应商：名称 / Base URL / API Key
        await page.getByRole("button", { name: /添加模型供应商/ }).click();
        const dialog = page.getByRole("dialog");
        await dialog.locator("#provider-name").fill(providerName);
        await dialog.locator("#provider-base-url").fill(mockServer.baseUrl);
        await dialog.locator("#provider-api-key").fill("sk-ui-key");
        await dialog
          .getByRole("button", { name: /创建供应商|保存更改/ })
          .click();

        // 创建成功后自动进入详情页
        await expect(page).toHaveURL(/\/management\/models\/[0-9a-f-]+$/);
        await expect(
          page.getByRole("heading", { name: providerName })
        ).toBeVisible();

        // 基本配置卡片展示掩码后的 API Key 与 Base URL
        const config = page.getByRole("definition");
        await expect(config.filter({ hasText: "sk-" })).toContainText("•");
        await expect(
          config.filter({ hasText: mockServer.baseUrl })
        ).toBeVisible();

        // 通过弹窗添加模型
        await page.getByRole("button", { name: /添加模型/ }).click();
        const modelDialog = page.getByRole("dialog");
        await modelDialog.locator("#model-name").fill("验收模型");
        await modelDialog.locator("#model-id").fill("ui-test-model");
        await modelDialog
          .getByRole("button", { name: /添加模型|保存更改/ })
          .click();

        // 模型行出现，并可通过「测试」连通本地 mock 服务
        const row = page.getByRole("row").filter({ hasText: "ui-test-model" });
        await expect(row).toBeVisible();
        await row.getByRole("button", { name: /测试/ }).click();
        await expect(page.getByText(/连接成功，耗时 \d+ ms/)).toBeVisible({
          timeout: 15_000,
        });

        // ⋯ 菜单设为默认后展示「默认」徽章
        await row.getByRole("button", { name: /更多操作/ }).click();
        await page.getByRole("menuitem", { name: /设为默认/ }).click();
        await expect(
          page.getByRole("row").filter({ hasText: "ui-test-model" })
        ).toContainText("默认");

        // 返回列表能看到该供应商与模型计数
        await page.goto(MODELS_URL);
        const providerRow = page
          .getByRole("row")
          .filter({ hasText: providerName });
        await expect(providerRow).toBeVisible();
        await expect(providerRow).toContainText("1");
      } finally {
        await mockServer.close();
      }
    });
  });
