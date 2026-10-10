"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * 加入页的两个动作：参与协作（写入协作成员后进入对话）或 Fork 新对话
 * （复制历史为本人新对话后进入）。token 来自链接 query，随请求回传校验。
 */
export function JoinActions({
  chatId,
  disabled,
  isMember = false,
  token,
}: {
  chatId: string;
  disabled?: boolean;
  isMember?: boolean;
  token: string;
}) {
  const t = useTranslations("chat");
  const router = useRouter();
  const [busy, setBusy] = useState<"fork" | "join" | null>(null);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  const runAction = useCallback(
    async (action: "fork" | "join") => {
      setBusy(action);
      try {
        const endpoint =
          action === "join" ? "/api/chat/share/join" : "/api/chat/fork";
        const response = await fetch(`${basePath}${endpoint}`, {
          body: JSON.stringify({ chatId, token }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const targetChatId =
          action === "fork"
            ? ((await response.json()) as { chatId: string }).chatId
            : chatId;
        router.push(`${basePath}/chat/${targetChatId}`);
      } catch {
        toast.error(t("join.actionFailed"));
        setBusy(null);
      }
    },
    [basePath, chatId, router, t, token]
  );

  const handleJoin = useCallback(async () => {
    if (isMember) {
      router.push(`${basePath}/chat/${chatId}`);
      return;
    }
    await runAction("join");
  }, [basePath, chatId, isMember, router, runAction]);

  const handleFork = useCallback(async () => {
    await runAction("fork");
  }, [runAction]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        className="h-10 flex-1 max-sm:min-h-11"
        disabled={disabled || busy !== null}
        onClick={handleJoin}
      >
        {busy === "join"
          ? t("join.joining")
          : isMember
            ? t("join.openChat")
            : t("join.join")}
      </Button>
      <Button
        className="h-10 flex-1 max-sm:min-h-11"
        disabled={disabled || busy !== null}
        onClick={handleFork}
        variant="outline"
      >
        {busy === "fork" ? t("join.forking") : t("join.fork")}
      </Button>
    </div>
  );
}
