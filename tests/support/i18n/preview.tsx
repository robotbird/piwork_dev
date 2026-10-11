import { NextIntlClientProvider } from "next-intl";
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { DocumentLibrary } from "../../../components/documents/document-library";
import { PreferencesProvider } from "../../../components/preferences-provider";
import { ScheduledTasksPanel } from "../../../components/scheduled-tasks/scheduled-tasks-panel";
import { SidebarProvider } from "../../../components/ui/sidebar";
import { TooltipProvider } from "../../../components/ui/tooltip";
import en from "../../../i18n/messages/en.json";
import zh from "../../../i18n/messages/zh.json";

function Preview() {
  const [locale, setLocale] = useState<"en" | "zh">("zh");
  const [view, setView] = useState("documents");
  const selectEnglish = useCallback(() => setLocale("en"), []);
  const selectChinese = useCallback(() => setLocale("zh"), []);
  const showDocuments = useCallback(() => setView("documents"), []);
  const showTasks = useCallback(() => setView("tasks"), []);
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : zh}
    >
      <PreferencesProvider>
        <nav>
          <button onClick={selectEnglish} type="button">
            English
          </button>
          <button onClick={selectChinese} type="button">
            中文
          </button>
          <button onClick={showDocuments} type="button">
            Documents preview
          </button>
          <button onClick={showTasks} type="button">
            Tasks preview
          </button>
        </nav>
        <TooltipProvider>
          <SidebarProvider>
            {view === "documents" ? (
              <DocumentLibrary />
            ) : (
              <ScheduledTasksPanel />
            )}
          </SidebarProvider>
        </TooltipProvider>
      </PreferencesProvider>
    </NextIntlClientProvider>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing preview root");
}
createRoot(root).render(<Preview />);
