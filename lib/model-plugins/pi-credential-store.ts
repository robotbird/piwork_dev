import "server-only";

import type {
  AuthOperationOptions,
  Credential,
  CredentialInfo,
  CredentialStore,
} from "@earendil-works/pi-ai";
import {
  getPluginInstallation,
  listPluginInstallations,
} from "@/lib/db/model-plugin-queries";
import { isTestEnvironment } from "../constants";
import { decryptPluginCredentials } from "./credentials";

/** 测试环境 faux 供应商（provider id 固定 deepseek）的 auth 门占位凭据 */
const TEST_FAUX_PROVIDER_ID = "deepseek";
const TEST_FAUX_CREDENTIAL: Credential = { key: "dummy", type: "api_key" };

/**
 * pi-ai CredentialStore 的 piwork DB 实现：把模型插件安装的加密凭据
 * （provider id 形如 `installation:<recordId>`，见 registry.ts buildRegistry）
 * 按需解密给 createAgentSession 的 pre-prompt 鉴权门。
 * 只读：写权归管理端，modify/delete 仅评估并告警，不落盘。
 */
export function createPluginCredentialStore(): CredentialStore {
  return {
    delete(providerId: string, _options?: AuthOperationOptions): Promise<void> {
      console.warn(
        `[piwork-credential-store] read-only store: ignoring credential delete for ${providerId}`
      );
      return Promise.resolve();
    },

    async list(
      _options?: AuthOperationOptions
    ): Promise<readonly CredentialInfo[]> {
      const records = (await listPluginInstallations()).filter(
        (record) => record.enabled && record.credentialsConfigured
      );
      const infos: CredentialInfo[] = records.map((record) => ({
        providerId: `installation:${record.id}`,
        type: "api_key",
      }));
      if (isTestEnvironment) {
        infos.push({
          providerId: TEST_FAUX_PROVIDER_ID,
          type: "api_key",
        });
      }
      return infos;
    },

    async modify(
      providerId: string,
      fn: (current: Credential | undefined) => Promise<Credential | undefined>,
      _options?: AuthOperationOptions
    ): Promise<Credential | undefined> {
      const current = await this.read(providerId);
      const next = await fn(current);
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        console.warn(
          `[piwork-credential-store] read-only store: ignoring credential write for ${providerId}`
        );
      }
      return current;
    },
    async read(
      providerId: string,
      _options?: AuthOperationOptions
    ): Promise<Credential | undefined> {
      if (isTestEnvironment && providerId === TEST_FAUX_PROVIDER_ID) {
        return TEST_FAUX_CREDENTIAL;
      }
      if (!providerId.startsWith("installation:")) {
        return;
      }
      const record = await getPluginInstallation(
        providerId.slice("installation:".length)
      );
      if (!record?.enabled || !record.credentialsConfigured) {
        return;
      }
      const credentials = decryptPluginCredentials(record.encryptedCredentials);
      // 与 ProviderPluginManager.activate 同源的 api_key 提取
      const key = String(credentials.api_key ?? "");
      if (!key) {
        return;
      }
      return { key, type: "api_key" };
    },
  };
}
