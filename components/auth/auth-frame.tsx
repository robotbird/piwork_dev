"use client";

import { Toaster } from "sonner";
import { PiLogo } from "@/components/auth/pi-logo";
import { RuntimeIllustration } from "@/components/auth/runtime-illustration";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full bg-white lg:min-h-[760px] text-[#111827]">
      <div className="relative flex min-h-dvh w-full flex-col px-7 py-8 sm:px-14 lg:w-[38%] lg:max-w-[580px] lg:shrink-0 lg:px-[clamp(40px,5vw,80px)] lg:py-10">
        <div className="mx-auto flex w-full max-w-[384px] flex-1 flex-col justify-center py-12 lg:-translate-y-16 lg:py-16">
          <div className="mb-14 flex items-center gap-4 sm:mb-16">
            <PiLogo className="size-12" />
            <span className="text-[42px] font-semibold leading-none tracking-[-0.055em] text-[#070f26]">
              piwork
            </span>
          </div>
          <div className="flex flex-col gap-3">{children}</div>
        </div>
      </div>
      <RuntimeIllustration />

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
