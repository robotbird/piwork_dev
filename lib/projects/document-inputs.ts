import { createHash } from "node:crypto";
import { DocumentInputError } from "@/lib/ai/document-errors";
import { LocalizedError } from "@/lib/i18n/messages";
import type { ProjectSourceReference } from "@/lib/runtime/protocol";
import { sourceImageMime } from "./source-files";

export const MAX_PROJECT_DOCUMENTS = 50;
export const MAX_PROJECT_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_PROJECT_TOTAL_TEXT_BYTES = 8 * 1024 * 1024;
export const PROJECT_SEGMENT_BYTES = 32 * 1024;
export const MAX_PROJECT_MANIFEST_BYTES = 128 * 1024;

export type ProjectDocumentSource = {
  id: string;
  name: string;
  type: string;
  content: string;
};

export function projectDocumentInputsEnabled(): boolean {
  return process.env.PIWORK_PROJECT_DOCUMENT_INPUTS_ENABLED !== "0";
}

export function textSha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Unknown legacy extraction quality must never be inferred from length. */
export function documentCompleteness(content: string) {
  return content.includes("[附件内容已截断]")
    ? "known_truncated"
    : "legacy_unknown";
}

export function projectSourceReferences(
  sources: readonly ProjectDocumentSource[]
): ProjectSourceReference[] {
  if (sources.length > MAX_PROJECT_DOCUMENTS) {
    throw new DocumentInputError("runtimeMessages.sourceCountInput");
  }
  let totalTextBytes = 0;
  const ids = new Set<string>();
  return sources.map((source) => {
    if (
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
        source.id
      ) ||
      ids.has(source.id)
    ) {
      throw new LocalizedError("runtimeMessages.sourceIdentityInvalid");
    }
    ids.add(source.id);
    const bytes = Buffer.byteLength(source.content, "utf8");
    if (!sourceImageMime(source.type)) {
      totalTextBytes += bytes;
      if (bytes > MAX_PROJECT_TEXT_BYTES) {
        throw new DocumentInputError("runtimeMessages.sourceTextLimit");
      }
    }
    if (totalTextBytes > MAX_PROJECT_TOTAL_TEXT_BYTES) {
      throw new DocumentInputError("runtimeMessages.totalTextLimit");
    }
    return { bytes, sha256: textSha256(source.content), sourceId: source.id };
  });
}

/** Lossless UTF-8 slices, including giant single lines. No normalization. */
export function splitProjectText(content: string): Buffer[] {
  const bytes = Buffer.from(content, "utf8");
  if (bytes.length > MAX_PROJECT_TEXT_BYTES) {
    throw new DocumentInputError("runtimeMessages.sourceTextLimit");
  }
  const segments: Buffer[] = [];
  for (let start = 0; start < bytes.length; ) {
    let end = Math.min(start + PROJECT_SEGMENT_BYTES, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    segments.push(bytes.subarray(start, end));
    start = end;
  }
  return segments;
}
