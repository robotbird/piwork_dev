import { NextIntlClientProvider } from "next-intl";
import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { JoinActions } from "../../components/chat/join-actions";
import { JoinDialog } from "../../components/chat/join-dialog";
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
        {window.location.search.includes("join") ? (
          <JoinDialog
            description="对话协作邀请"
            footer="链接 7 天内有效，仅限本平台已登录的启用成员使用"
            title="邀请对话"
          >
            <p>你已在该对话的协作成员中。</p>
            <JoinActions
              chatId="preview-chat"
              isMember={!window.location.search.includes("new-member")}
              token="fixture-invite"
            />
          </JoinDialog>
        ) : (
          <ShareDialog
            chatId="preview-chat"
            onClose={handleClose}
            open={open}
          />
        )}
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
