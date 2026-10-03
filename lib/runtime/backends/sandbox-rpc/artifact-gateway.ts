import type { JsonAgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { MAX_DELIVER_FILE_SIZE } from "@/lib/ai/agent-tools";
import { getSupportedAttachmentType } from "@/lib/ai/attachment-types";
import type { StoredFile } from "@/lib/ai/file-store";
import { storeFile } from "@/lib/ai/file-store";
import type { RuntimeEvent } from "../../protocol";
import type { AsyncEventQueue } from "../event-queue";
import { DELIVER_FILE_TOOL_NAME } from "./deliver-file-extension";

/**
 * Artifact Gateway 宿主侧（spec §6 Phase 2 / §8「出站走显式网关」）：收割
 * 沙箱 outbox manifest，经 storeFile 出站、归档回调入文档库，并把
 * artifact.created 推进会话事件流（与 InProcessBackend 的 deliver_file 闭包
 * 同一终效：前端附件卡 + message-builder 持久化）。
 *
 * 触发点：官方 RpcClient.onEvent 的 tool_execution_end（result.details.manifest
 * 由沙箱内 deliver-file extension 填写）。收割串行（保序）且吞错——交付失败
 * 不应击穿 run（best-effort，同 in-process onStored 缺省语义）。
 */

export type ArtifactStore = (input: {
  buffer: Uint8Array;
  contentType: string;
  filename: string;
}) => Promise<StoredFile>;

export type ArtifactArchive = (
  chatId: string,
  file: StoredFile,
  size: number
) => Promise<void>;

export type ArtifactGatewayOptions = {
  chatId: string;
  queue: AsyncEventQueue<RuntimeEvent>;
  /** workspace 相对路径读取（通常绑定 SandboxHandle.readFile，遏制由其保证） */
  readFile: (file: string) => Promise<Uint8Array>;
  /** 出站存储（默认 lib/ai/file-store storeFile；测试注入替身） */
  store?: ArtifactStore;
  /** 归档回调（生产为 registerGeneratedFile；缺省跳过） */
  archiveFile?: ArtifactArchive;
};

type OutboxManifest = {
  id: string;
  path: string;
  filename: string;
  size: number;
};

/** 官方事件的最小结构判别（JsonAgentSessionEvent 是大联合，按需收窄） */
function deliverFileManifestOf(
  event: JsonAgentSessionEvent
): string | undefined {
  if (event.type !== "tool_execution_end") {
    return;
  }
  if (event.toolName !== DELIVER_FILE_TOOL_NAME || event.isError) {
    return;
  }
  const details = (event.result as { details?: unknown } | undefined | null)
    ?.details;
  const manifest = (details as { manifest?: unknown } | undefined | null)
    ?.manifest;
  return typeof manifest === "string" ? manifest : undefined;
}

function parseManifest(bytes: Uint8Array): OutboxManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.path !== "string" ||
    typeof candidate.filename !== "string" ||
    typeof candidate.size !== "number"
  ) {
    return null;
  }
  return {
    filename: candidate.filename,
    id: candidate.id,
    path: candidate.path,
    size: candidate.size,
  };
}

export function createArtifactGateway(options: ArtifactGatewayOptions): {
  /** 挂到 client.onEvent；返回值即 unsubscribe */
  handleEvent: (event: JsonAgentSessionEvent) => void;
  /** 等待在途收割完成（会话 close 前调用，缩小「settled 抢跑销毁」窗口） */
  flush: () => Promise<void>;
} {
  const store = options.store ?? storeFile;
  const processed = new Set<string>();
  let chain: Promise<unknown> = Promise.resolve();

  const harvest = async (manifestPath: string): Promise<void> => {
    const manifestBytes = await options.readFile(manifestPath);
    const manifest = parseManifest(manifestBytes);
    if (!manifest) {
      console.error("[artifact-gateway] invalid manifest", { manifestPath });
      return;
    }
    if (processed.has(manifest.id)) {
      return;
    }
    processed.add(manifest.id);
    if (manifest.size > MAX_DELIVER_FILE_SIZE) {
      console.error("[artifact-gateway] manifest exceeds size limit", {
        id: manifest.id,
        size: manifest.size,
      });
      return;
    }
    // 载荷路径由沙箱内扩展写入（workspace 相对）；readFile 的路径遏制由
    // 绑定的 SandboxHandle 保证
    const bytes = await options.readFile(manifest.path);
    if (bytes.byteLength > MAX_DELIVER_FILE_SIZE) {
      console.error("[artifact-gateway] file exceeds size limit", {
        id: manifest.id,
        size: bytes.byteLength,
      });
      return;
    }
    const contentType =
      getSupportedAttachmentType(manifest.filename)?.mediaType ??
      "application/octet-stream";
    const stored = await store({
      buffer: bytes,
      contentType,
      filename: manifest.filename,
    });
    await options.archiveFile?.(options.chatId, stored, bytes.byteLength);
    options.queue.push({
      file: {
        contentType,
        downloadUrl: stored.downloadUrl,
        filename: manifest.filename,
        url: stored.url,
      },
      type: "artifact.created",
    });
  };

  return {
    flush: () =>
      chain.then(
        () => undefined,
        () => undefined
      ),
    handleEvent: (event) => {
      const manifestPath = deliverFileManifestOf(event);
      if (manifestPath === undefined) {
        return;
      }
      // 串行收割保序；错误只记录不外抛（交付 best-effort）——链尾恒 catch，
      // chain 永不 reject，后续收割不受前次失败影响
      chain = chain
        .then(() => harvest(manifestPath))
        .catch((error: unknown) => {
          console.error("[artifact-gateway] harvest failed", {
            error: error instanceof Error ? error.message : String(error),
            manifestPath,
          });
        });
    },
  };
}
