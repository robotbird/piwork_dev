"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Route-backed invitation modal; closing never grants access or joins a chat. */
export function JoinDialog({
  children,
  description,
  footer,
  title,
}: {
  children?: ReactNode;
  description: string;
  footer?: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        router.replace(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
      }
    },
    [router]
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-[22px] p-0 shadow-[0_18px_55px_rgb(0_0_0/0.16),0_2px_8px_rgb(0_0_0/0.08)] sm:max-w-[520px]"
        overlayClassName="bg-foreground/20"
      >
        <DialogHeader className="shrink-0 px-6 pb-5 pt-6 pr-14">
          <DialogTitle className="break-words text-base font-semibold leading-6">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-5">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children ? (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
            {children}
          </div>
        ) : null}
        {footer ? (
          <p className="shrink-0 border-t bg-muted/30 px-6 py-5 text-xs leading-5 text-muted-foreground">
            {footer}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
