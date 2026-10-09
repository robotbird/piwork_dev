import { NextIntlClientProvider } from "next-intl";
import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { ShareDialog } from "../../components/chat/share-dialog";
import { TooltipProvider } from "../../components/ui/tooltip";
import messages from "../../i18n/messages/zh.json";

function Preview() {
  const [open, setOpen] = useState(true);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  return (
    <NextIntlClientProvider locale="zh" messages={messages}>
      <TooltipProvider>
        <button onClick={handleOpen} type="button">
          分享
        </button>
        <ShareDialog chatId="preview-chat" onClose={handleClose} open={open} />
      </TooltipProvider>
    </NextIntlClientProvider>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Preview root is missing");
}
createRoot(root).render(
  <StrictMode>
    <Preview />
  </StrictMode>
);
