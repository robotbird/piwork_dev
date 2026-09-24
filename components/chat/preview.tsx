"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { usePreferences } from "@/components/preferences-provider";
import { SparklesIcon } from "./icons";

function PreviewSuggestionButton({
  suggestion,
  onAction,
}: {
  suggestion: string;
  onAction: (query?: string) => void;
}) {
  const handleClick = useCallback(() => {
    onAction(suggestion);
  }, [onAction, suggestion]);

  return (
    <button
      className="rounded-xl border border-border/30 bg-card/20 px-3 py-2.5 text-left text-[11px] leading-relaxed text-muted-foreground/70 transition-all duration-200 hover:border-border/60 hover:bg-card/40 hover:text-muted-foreground"
      onClick={handleClick}
      type="button"
    >
      {suggestion}
    </button>
  );
}

export function Preview() {
  const router = useRouter();
  const { language, t } = usePreferences();
  const suggestions =
    language === "zh"
      ? [
          "总结这份文档的关键结论",
          "帮我起草一份项目执行计划",
          "分析这组数据并提出建议",
          "将这段内容整理成专业报告",
        ]
      : [
          "Summarize the key findings in this document",
          "Draft a project execution plan",
          "Analyze this data and suggest next steps",
          "Turn this content into a professional report",
        ];

  const handleAction = useCallback(
    (query?: string) => {
      const url = query ? `/?query=${encodeURIComponent(query)}` : "/";
      router.push(url);
    },
    [router]
  );

  const handleDefaultAction = useCallback(() => {
    handleAction();
  }, [handleAction]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-tl-2xl bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/20 px-5">
        <div className="flex size-5 items-center justify-center rounded bg-muted/60 ring-1 ring-border/50">
          <SparklesIcon size={10} />
        </div>
        <span className="text-sm text-muted-foreground">
          {t("chat.chatbot")}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("chat.confirmWhatCanIHelpWith")}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("chat.askAQuestionWriteCodeOrExplore")}
          </p>
        </div>

        <div className="grid w-full max-w-md grid-cols-2 gap-2">
          {suggestions.map((suggestion) => (
            <PreviewSuggestionButton
              key={suggestion}
              onAction={handleAction}
              suggestion={suggestion}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-5">
        <button
          className="flex w-full items-center rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-[var(--hairline-strong)] hover:text-foreground"
          onClick={handleDefaultAction}
          type="button"
        >
          {t("chat.askAnythingAction")}
        </button>
      </div>
    </div>
  );
}
