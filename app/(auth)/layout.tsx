"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Toaster } from "sonner";
import { SparklesIcon } from "@/components/chat/icons";
import { Preview } from "@/components/chat/preview";
import { usePreferences } from "@/components/preferences-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = usePreferences();

  return (
    <div className="flex h-dvh w-screen bg-sidebar">
      <div className="flex w-full flex-col bg-background p-8 xl:w-[600px] xl:shrink-0 xl:border-r xl:border-border md:p-16">
        <Link
          className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          href="/"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("auth.back")}
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10">
          <div className="flex flex-col gap-2">
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground">
              <SparklesIcon size={14} />
            </div>
            {children}
          </div>
        </div>
      </div>

      <div className="hidden flex-1 flex-col overflow-hidden pl-12 xl:flex">
        <div className="flex items-center gap-1.5 pt-8 text-[13px] text-muted-foreground/50">
          {t("auth.poweredBy")}
          <span className="font-medium text-muted-foreground">
            pi + DeepSeek
          </span>
        </div>
        <div className="flex-1 pt-4">
          <Preview />
        </div>
      </div>

      {/* 登录/注册失败等提示（sonner）需要挂载点，否则用户看不到任何反馈 */}
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-[var(--hairline-strong)] !shadow-none",
        }}
      />
    </div>
  );
}
