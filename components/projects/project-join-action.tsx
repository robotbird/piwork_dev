"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { request } from "./shared";
export function ProjectJoinAction({
  projectId,
  token,
}: {
  projectId: string;
  token: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const join = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await request("/api/projects/share/join", {
        body: JSON.stringify({ projectId, token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch {
      toast.error("加入失败，分享链接可能已失效");
      setBusy(false);
    }
  }, [busy, projectId, router, token]);
  return (
    <Button
      className="w-full cursor-pointer rounded-full"
      disabled={busy}
      onClick={join}
    >
      {busy ? "正在加入…" : "加入项目"}
    </Button>
  );
}
