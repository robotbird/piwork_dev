"use client";

import type { SourceFileType } from "@/lib/projects/source-files";

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectChatSummary = {
  chatId: string;
  createdAt: string;
  lastMessageAt: string | null;
  summary: string | null;
  title: string;
  updatedAt: string;
};

export type ProjectSourceSummary = {
  createdAt: string;
  id: string;
  name: string;
  type: SourceFileType;
};

/** 统一 JSON 请求：非 2xx 抛出服务端返回的 error 文本 */
export async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "请求失败";
    throw new Error(message);
  }
  return body as T;
}

/** 「9月28日」式短日期；跨年时带年份 */
export function formatShortDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("zh-CN", {
    day: "numeric",
    month: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
