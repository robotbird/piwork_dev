import { NextIntlClientProvider } from "next-intl";
import { createRoot } from "react-dom/client";
import { SandboxSettingsPage } from "../../components/admin/sandbox-settings-page";
import messages from "../../i18n/messages/zh.json";

async function preview() {
  const response = await fetch("/api/admin/sandbox-settings");
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Missing root");
  }
  createRoot(root).render(
    <NextIntlClientProvider locale="zh" messages={messages}>
      <SandboxSettingsPage initialData={await response.json()} />
    </NextIntlClientProvider>
  );
}
preview().catch((error) => {
  throw error;
});
