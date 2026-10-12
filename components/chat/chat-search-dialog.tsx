"use client";

import { Command as CommandPrimitive } from "cmdk";
import { MessageCircleIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChatSearchResult } from "@/lib/db/chat-search-queries";
import { fetcher } from "@/lib/utils";

export function ChatSearchDialog({
  open,
  onOpenChange,
  onNavigate,
  signedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
  signedIn: boolean;
}) {
  const t = useTranslations("chatSearch");
  const router = useRouter();
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);
  const { data, error, isLoading, mutate } = useSWR<{
    chats: ChatSearchResult[];
    hasMore: boolean;
  }>(
    open && signedIn
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history/search?q=${encodeURIComponent(debounced)}`
      : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const handleRetry = useCallback(() => {
    mutate();
  }, [mutate]);
  const handleSelect = useCallback(
    (id: string) => {
      onOpenChange(false);
      onNavigate();
      router.push(`/chat/${id}`);
    },
    [onOpenChange, onNavigate, router]
  );
  const pending = query.trim() !== debounced || isLoading;
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="chat-search-dialog gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-[720px]"
        overlayClassName="bg-background/60"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>
        <Command
          className="rounded-none bg-background p-0"
          shouldFilter={false}
        >
          <div className="flex items-center gap-3 px-6 py-4">
            <CommandPrimitive.Input
              aria-label={t("title")}
              autoFocus
              className="h-8 min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
              data-slot="chat-search-input"
              maxLength={200}
              onValueChange={setQuery}
              placeholder={t("placeholder")}
              style={{
                border: 0,
                boxShadow: "none",
                outline: "none",
                outlineOffset: 0,
              }}
              value={query}
            />
            <DialogClose asChild>
              <Button aria-label={tc("close")} size="icon-sm" variant="ghost">
                <XIcon />
              </Button>
            </DialogClose>
          </div>
          <CommandList
            aria-busy={pending}
            className="h-[min(388px,60dvh)] max-h-[60dvh] px-4 pb-8"
          >
            {signedIn ? (
              pending ? (
                <p
                  className="py-12 text-center text-muted-foreground"
                  role="status"
                >
                  {t("loading")}
                </p>
              ) : error ? (
                <div
                  className="flex flex-col items-center gap-3 py-12"
                  role="alert"
                >
                  <p>{t("error")}</p>
                  <Button onClick={handleRetry} variant="outline">
                    {t("retry")}
                  </Button>
                </div>
              ) : data?.chats.length ? (
                <CommandGroup
                  className="p-0 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-2 **:[[cmdk-group-heading]]:text-sm **:[[cmdk-group-heading]]:font-normal"
                  heading={debounced ? t("results") : t("recent")}
                >
                  {data.chats.map((chat) => (
                    <CommandItem
                      className="min-h-12 cursor-pointer gap-4 rounded-lg px-3 py-3 bg-transparent hover:bg-accent/60 data-[selected=true]:bg-accent/60"
                      key={chat.id}
                      onSelect={handleSelect}
                      value={chat.id}
                    >
                      <MessageCircleIcon />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{chat.title}</p>
                        {chat.snippet ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {chat.snippet}
                          </p>
                        ) : null}
                      </div>
                      {chat.sharedWithMe ? (
                        <span className="text-xs text-muted-foreground">
                          {t("shared")}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <p
                  className="py-12 text-center text-muted-foreground"
                  role="status"
                >
                  {debounced ? t("empty") : t("noHistory")}
                </p>
              )
            ) : (
              <p className="py-12 text-center text-muted-foreground">
                {t("signIn")}
              </p>
            )}
          </CommandList>
          {debounced && data?.hasMore && !pending && !error ? (
            <p className="px-6 pb-4 text-xs text-muted-foreground">
              {t("limit")}
            </p>
          ) : null}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
