import "server-only";

import { getActiveModelCatalog } from "@/lib/ai/active-models";
import { readBoundedStoredFile } from "@/lib/ai/bounded-stored-file";
import {
  canExecuteDurableChatRun,
  isEnabledDurableChatUser,
} from "@/lib/db/durable-chat-queries";
import {
  getLibraryFileByUrl,
  getLibraryItem,
  registerLibraryFile,
} from "@/lib/db/library-queries";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import {
  type DurableChatFiles,
  prepareDurableChatAttachments,
} from "../backends/durable/chat-attachments";
import { DurableChatBackend } from "../backends/durable/chat-backend";
import {
  assertDurableChatUser,
  type DurableChatConfig,
  isDurableChatUserAllowed,
  readDurableChatConfig,
} from "../backends/durable/chat-policy";
import { buildSandboxProvider } from "../sandbox/configuration";
import { LeasingSandboxProvider } from "../sandbox/leasing";
import { dbSandboxRegistry } from "../sandbox/registry";

function files(config: DurableChatConfig): DurableChatFiles {
  return {
    byId: getLibraryItem,
    byUrl: getLibraryFileByUrl,
    read: (url, maxBytes, signal) =>
      readBoundedStoredFile(url, config.filesRoot, maxBytes, signal),
  };
}
export async function durableChatAvailable(userId: string): Promise<boolean> {
  const config = readDurableChatConfig();
  return Boolean(
    isDurableChatUserAllowed(config, userId) &&
      (await isEnabledDurableChatUser(userId))
  );
}
export async function assertDurableChatAdmission(userId: string) {
  const config = readDurableChatConfig();
  try {
    assertDurableChatUser(config, userId);
  } catch (error) {
    throw new ChatbotError("forbidden:chat", { cause: error });
  }
  if (!(await isEnabledDurableChatUser(userId))) {
    throw new ChatbotError("forbidden:chat");
  }
  if (!config) {
    throw new ChatbotError("forbidden:chat");
  }
  return config;
}
export async function prepareDurableChatTurn(
  userId: string,
  message: ChatMessage,
  signal?: AbortSignal
) {
  const config = await assertDurableChatAdmission(userId);
  return prepareDurableChatAttachments(userId, message, files(config), signal);
}
export function buildDurableChatBackend(config: DurableChatConfig) {
  const provider = new LeasingSandboxProvider(
    buildSandboxProvider(config.provider),
    dbSandboxRegistry,
    { reuse: false }
  );
  return new DurableChatBackend(provider, {
    archive: (userId, file, size) =>
      registerLibraryFile({ file, size, source: "ai", userId }),
    authorizeRun: canExecuteDurableChatRun,
    config: readDurableChatConfig,
    files: files(config),
    modelEnabled: async (modelId) =>
      (await getActiveModelCatalog()).models.some(
        (model) => model.id === modelId
      ),
  });
}
