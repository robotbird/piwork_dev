"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  BrainIcon,
  EyeIcon,
  FolderIcon,
  HammerIcon,
  LibraryBigIcon,
  LockIcon,
  MicIcon,
  PlusIcon,
  PuzzleIcon,
  WrenchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { usePreferences } from "@/components/preferences-provider";
import {
  CHAT_ATTACHMENT_ACCEPT,
  MAX_CHAT_ATTACHMENT_COUNT,
} from "@/lib/ai/attachment-types";
import {
  type ChatModel,
  chatModels,
  DEFAULT_CHAT_MODEL,
  type ModelCapabilities,
} from "@/lib/ai/models";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn, fetcher } from "@/lib/utils";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "../ai-elements/prompt-input";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ArrowUpIcon, ChevronDownIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import {
  createSkillSlashCommands,
  type SkillSummary,
  type SlashCommand,
  SlashCommandMenu,
  slashCommands,
} from "./slash-commands";
import type { VisibilityType } from "./visibility-selector";

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedModelId,
  onModelChange,
  editingMessage,
  onCancelEdit,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage:
    | UseChatHelpers<ChatMessage>["sendMessage"]
    | (() => Promise<void>);
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  isLoading?: boolean;
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { translate } = usePreferences();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const hasAutoFocused = useRef(false);
  useEffect(() => {
    if (!hasAutoFocused.current && width) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [width]);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
    }
  }, [localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [selectedSkill, setSelectedSkill] = useState<{
    displayName: string;
    name: string;
  } | null>(null);
  const skillsEndpoint = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/skills`;
  const { data: skillsData, mutate: refreshSkills } = useSWR<{
    skills: SkillSummary[];
  }>(skillsEndpoint, fetcher, {
    revalidateOnFocus: true,
  });
  // 技能在前、内置指令在后（与参考设计的分组顺序一致，键盘索引自洽）
  const availableSlashCommands = useMemo(
    () => [
      ...createSkillSlashCommands(skillsData?.skills ?? []),
      ...slashCommands,
    ],
    [skillsData?.skills]
  );
  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;
    if (previousStatus !== "ready" && status === "ready") {
      refreshSkills();
    }
  }, [refreshSkills, status]);

  const handleInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const val = event.target.value;
      setInput(val);

      if (val.startsWith("/") && !val.includes(" ")) {
        setSlashOpen(true);
        setSlashQuery(val.slice(1));
        setSlashIndex(0);
      } else {
        setSlashOpen(false);
      }
    },
    [setInput]
  );

  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      setSlashOpen(false);
      if (cmd.action === "skill" && cmd.skillName) {
        setSelectedSkill({
          displayName: cmd.displayName ?? cmd.skillName,
          name: cmd.skillName,
        });
        setInput("");
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }

      setSelectedSkill(null);
      setInput("");
      switch (cmd.action) {
        case "new":
          router.push("/");
          break;
        case "clear":
          setMessages(() => []);
          break;
        case "rename":
          toast("Rename is available from the sidebar chat menu.");
          break;
        case "model": {
          const modelBtn = document.querySelector<HTMLButtonElement>(
            "[data-testid='model-selector']"
          );
          modelBtn?.click();
          break;
        }
        case "theme":
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          break;
        case "delete":
          toast("Delete this chat?", {
            action: {
              label: "Delete",
              onClick: () => {
                fetch(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatId}`,
                  { method: "DELETE" }
                );
                router.push("/");
                toast.success("Chat deleted");
              },
            },
          });
          break;
        case "purge":
          toast("Delete all chats?", {
            action: {
              label: "Delete all",
              onClick: () => {
                fetch(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`,
                  {
                    method: "DELETE",
                  }
                );
                router.push("/");
                toast.success("All chats deleted");
              },
            },
          });
          break;
        default:
          break;
      }
    },
    [chatId, resolvedTheme, router, setInput, setMessages, setTheme]
  );

  const submitForm = useCallback(() => {
    window.history.pushState(
      {},
      "",
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
    );

    const task = input.trim();
    const messageText = selectedSkill
      ? `/${selectedSkill.name}${task ? ` ${task}` : ""}`
      : input;

    sendMessage({
      parts: [
        ...attachments.map((attachment) => ({
          filename: attachment.name,
          mediaType: attachment.contentType,
          type: "file" as const,
          url: attachment.url,
        })),
        ...(messageText.trim()
          ? [
              {
                text: messageText,
                type: "text" as const,
              },
            ]
          : []),
      ],
      role: "user",
    });

    setAttachments([]);
    setLocalStorageInput("");
    setInput("");
    setSelectedSkill(null);
    setSlashOpen(false);

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    selectedSkill,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
        {
          body: formData,
          method: "POST",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType, name } = data;

        return {
          contentType,
          name: name ?? pathname,
          url,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const availableSlots = Math.max(
        0,
        MAX_CHAT_ATTACHMENT_COUNT - attachments.length
      );
      const selectedFiles = Array.from(event.target.files || []);
      const files = selectedFiles.slice(0, availableSlots);

      if (selectedFiles.length > availableSlots) {
        toast.error(`每条消息最多上传 ${MAX_CHAT_ATTACHMENT_COUNT} 个附件`);
      }
      if (files.length === 0) {
        event.target.value = "";
        return;
      }

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch {
        toast.error("Failed to upload files");
      } finally {
        setUploadQueue([]);
        event.target.value = "";
      }
    },
    [attachments.length, setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );
      const availableSlots = Math.max(
        0,
        MAX_CHAT_ATTACHMENT_COUNT - attachments.length
      );
      const acceptedImageItems = imageItems.slice(0, availableSlots);

      if (imageItems.length === 0) {
        return;
      }
      if (acceptedImageItems.length === 0) {
        toast.error(`每条消息最多上传 ${MAX_CHAT_ATTACHMENT_COUNT} 个附件`);
        return;
      }
      if (acceptedImageItems.length < imageItems.length) {
        toast.error(`每条消息最多上传 ${MAX_CHAT_ATTACHMENT_COUNT} 个附件`);
      }

      event.preventDefault();

      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = acceptedImageItems
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
          .map((file) => uploadFile(file));

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch {
        toast.error("Failed to upload pasted image(s)");
      } finally {
        setUploadQueue([]);
      }
    },
    [attachments.length, setAttachments, uploadFile]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleCancelEditMouseDown = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onCancelEdit?.();
    },
    [onCancelEdit]
  );

  const handleProjectSelect = useCallback(() => {
    toast.info(
      translate("项目选择即将开放", "Project selection is coming soon")
    );
  }, [translate]);

  const handleFileBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePluginSelect = useCallback(() => {
    toast.info(
      translate("插件选择即将开放", "Plugin selection is coming soon")
    );
  }, [translate]);

  const handleVoiceInput = useCallback(() => {
    toast.info(translate("语音输入即将开放", "Voice input is coming soon"));
  }, [translate]);

  const handlePromptSubmit = useCallback(() => {
    if (input.startsWith("/") && !input.includes(" ")) {
      const query = input.slice(1).trim();
      const cmd = slashCommands.find((c) => c.name === query);
      if (cmd) {
        handleSlashSelect(cmd);
        return;
      }
    }
    if (!(input.trim() || selectedSkill) && attachments.length === 0) {
      return;
    }
    if (status === "ready" || status === "error") {
      submitForm();
    } else {
      toast.error("Please wait for the model to finish its response!");
    }
  }, [
    attachments.length,
    handleSlashSelect,
    input,
    selectedSkill,
    status,
    submitForm,
  ]);

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Backspace" && input === "" && selectedSkill) {
        e.preventDefault();
        setSelectedSkill(null);
        setInput(`/${selectedSkill.name}`);
        setSlashOpen(true);
        setSlashQuery(selectedSkill.name);
        setSlashIndex(0);
        return;
      }

      if (slashOpen) {
        const filtered = availableSlashCommands.filter((cmd) =>
          cmd.name.startsWith(slashQuery.toLowerCase())
        );
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((i) => Math.min(i + 1, filtered.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          if (filtered[slashIndex]) {
            handleSlashSelect(filtered[slashIndex]);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashOpen(false);
          return;
        }
      }
      if (e.key === "Escape" && editingMessage && onCancelEdit) {
        e.preventDefault();
        onCancelEdit();
      }
    },
    [
      editingMessage,
      availableSlashCommands,
      handleSlashSelect,
      input,
      onCancelEdit,
      selectedSkill,
      setInput,
      slashIndex,
      slashOpen,
      slashQuery,
    ]
  );
  const isEmptyChat = messages.length === 0;
  const canSubmit = Boolean(
    input.trim() || selectedSkill || attachments.length > 0
  );
  const isGenerating = status === "submitted" || status === "streaming";

  return (
    <div className={cn("relative flex w-full flex-col gap-3", className)}>
      {editingMessage && onCancelEdit ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>Editing message</span>
          <button
            className="rounded px-1.5 py-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            onMouseDown={handleCancelEditMouseDown}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <input
        accept={CHAT_ATTACHMENT_ACCEPT}
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <div className="relative">
        {slashOpen ? (
          <SlashCommandMenu
            commands={availableSlashCommands}
            onSelect={handleSlashSelect}
            query={slashQuery}
            selectedIndex={slashIndex}
          />
        ) : null}
      </div>

      <PromptInput
        className={cn(
          "openai-composer relative z-10",
          isEmptyChat
            ? "openai-composer--empty"
            : "openai-composer--conversation"
        )}
        onSubmit={handlePromptSubmit}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className={cn(
              "flex w-full self-start flex-row gap-2 overflow-x-auto px-3 pt-3 no-scrollbar",
              !isEmptyChat && "basis-full"
            )}
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <AttachmentPreviewItem
                attachment={attachment}
                fileInputRef={fileInputRef}
                key={attachment.url}
                setAttachments={setAttachments}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  contentType: "",
                  name: filename,
                  url: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        {isEmptyChat ? (
          <>
            <div className="flex min-h-[64px] w-full items-start px-5 pt-4">
              {selectedSkill ? (
                <span
                  className="mt-px inline-flex h-6 shrink-0 items-center gap-1.5 text-sm font-medium leading-6 text-primary"
                  data-testid="selected-skill"
                >
                  <HammerIcon aria-hidden="true" className="size-4" />
                  <span>{selectedSkill.displayName}</span>
                </span>
              ) : null}
              <PromptInputTextarea
                className={cn(
                  "min-h-[48px] px-0 pb-1 pt-0 text-[16px] leading-6 placeholder:text-[var(--chat-placeholder)] focus-visible:border-transparent focus-visible:ring-0",
                  selectedSkill && "ml-2"
                )}
                data-testid="multimodal-input"
                onChange={handleInput}
                onKeyDown={handleTextareaKeyDown}
                placeholder={
                  editingMessage
                    ? translate("编辑你的消息...", "Edit your message...")
                    : selectedSkill
                      ? translate("请完善你的任务...", "Describe your task...")
                      : translate("处理任何事务", "Ask anything")
                }
                ref={textareaRef}
                value={input}
              />
            </div>
            <PromptInputFooter className="px-3 pb-2.5 pt-1">
              <PromptInputTools>
                <AttachmentsButton
                  fileInputRef={fileInputRef}
                  status={status}
                />
              </PromptInputTools>
              <PromptInputTools className="gap-1">
                <ModelSelectorCompact
                  onModelChange={onModelChange}
                  selectedModelId={selectedModelId}
                />
                <Button
                  aria-label={translate("语音输入", "Voice input")}
                  className="size-10 rounded-full text-foreground hover:bg-muted"
                  onClick={handleVoiceInput}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <MicIcon className="size-[19px]" />
                </Button>
                {isGenerating ? (
                  <StopButton setMessages={setMessages} stop={stop} />
                ) : (
                  <PromptInputSubmit
                    className={cn(
                      "size-10 rounded-full border-0 transition-colors duration-150",
                      canSubmit
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-[#b8d4ff] text-white"
                    )}
                    data-testid="send-button"
                    disabled={!canSubmit || uploadQueue.length > 0}
                    status={status}
                    variant="secondary"
                  >
                    <ArrowUpIcon className="size-5" />
                  </PromptInputSubmit>
                )}
              </PromptInputTools>
            </PromptInputFooter>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 items-end gap-1 px-1.5 py-1.5">
            <AttachmentsButton fileInputRef={fileInputRef} status={status} />
            {selectedSkill ? (
              <span
                className="mb-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 text-sm font-medium text-foreground"
                data-testid="selected-skill"
              >
                <HammerIcon aria-hidden="true" className="size-4" />
                <span>{selectedSkill.displayName}</span>
              </span>
            ) : null}
            <PromptInputTextarea
              className={cn(
                "max-h-32 min-h-10 min-w-0 px-2 py-2 text-[16px] leading-6 placeholder:text-[var(--chat-placeholder)] focus-visible:border-transparent focus-visible:ring-0",
                selectedSkill && "pl-0"
              )}
              data-testid="multimodal-input"
              onChange={handleInput}
              onKeyDown={handleTextareaKeyDown}
              placeholder={
                editingMessage
                  ? translate("编辑你的消息...", "Edit your message...")
                  : translate("处理任何事务", "Ask anything")
              }
              ref={textareaRef}
              value={input}
            />
            <ModelSelectorCompact
              onModelChange={onModelChange}
              selectedModelId={selectedModelId}
            />
            <Button
              aria-label={translate("语音输入", "Voice input")}
              className="size-10 rounded-full text-foreground hover:bg-muted"
              onClick={handleVoiceInput}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <MicIcon className="size-[19px]" />
            </Button>
            {isGenerating ? (
              <StopButton setMessages={setMessages} stop={stop} />
            ) : (
              <PromptInputSubmit
                className={cn(
                  "size-10 rounded-full border-0 transition-colors duration-150",
                  canSubmit
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary text-muted-foreground"
                )}
                data-testid="send-button"
                disabled={!canSubmit || uploadQueue.length > 0}
                status={status}
                variant="secondary"
              >
                <ArrowUpIcon className="size-5" />
              </PromptInputSubmit>
            )}
          </div>
        )}
      </PromptInput>

      {isEmptyChat ? (
        <div className="relative z-0 mx-5 -mt-4 flex h-12 items-end rounded-b-2xl bg-[#f7f7f7] px-1.5 pb-1.5 text-sm text-muted-foreground dark:bg-muted">
          <div className="flex min-w-0 items-center gap-2">
            <button
              aria-label={translate("选择项目", "Choose project")}
              className="flex h-8 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-background hover:text-foreground"
              onClick={handleProjectSelect}
              type="button"
            >
              <FolderIcon className="size-[18px] shrink-0" />
              <span>{translate("项目", "Project")}</span>
            </button>
            <button
              aria-label={translate("添加文件", "Add files")}
              className="flex h-8 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={status !== "ready"}
              onClick={handleFileBrowse}
              type="button"
            >
              <LibraryBigIcon className="size-[18px] shrink-0" />
              <span>{translate("文件", "Files")}</span>
            </button>
            <button
              aria-label={translate("选择插件", "Choose plugins")}
              className="hidden h-8 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-background hover:text-foreground sm:flex"
              onClick={handlePluginSelect}
              type="button"
            >
              <PuzzleIcon className="size-[18px] shrink-0" />
              <span>{translate("插件", "Plugins")}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (prevProps.editingMessage !== nextProps.editingMessage) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.messages.length !== nextProps.messages.length) {
      return false;
    }

    return true;
  }
);

function PureAttachmentPreviewItem({
  attachment,
  fileInputRef,
  setAttachments,
}: {
  attachment: Attachment;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
}) {
  const handleRemove = useCallback(() => {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((a) => a.url !== attachment.url)
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [attachment.url, fileInputRef, setAttachments]);

  return <PreviewAttachment attachment={attachment} onRemove={handleRemove} />;
}

const AttachmentPreviewItem = memo(PureAttachmentPreviewItem);

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      fileInputRef.current?.click();
    },
    [fileInputRef]
  );

  return (
    <Button
      className="size-8 rounded-md border-0 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      data-testid="attachments-button"
      disabled={status !== "ready"}
      onClick={handleClick}
      variant="ghost"
    >
      <PlusIcon className="size-5" />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function ModelSelectorOption({
  capabilities,
  curated,
  model,
  onModelChange,
  selectedModelId,
  setOpen,
}: {
  capabilities: Record<string, ModelCapabilities> | undefined;
  curated: boolean;
  model: ChatModel;
  onModelChange?: (modelId: string) => void;
  selectedModelId: string;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const [logoProvider] = model.id.split("/");
  const maybeWithTooltip = (icon: ReactNode, label: string) => {
    if (!curated) {
      return icon;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{icon}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };
  const handleSelect = useCallback(() => {
    if (!curated) {
      return;
    }
    onModelChange?.(model.id);
    setCookie("chat-model", model.id);
    setOpen(false);
    setTimeout(() => {
      document
        .querySelector<HTMLTextAreaElement>("[data-testid='multimodal-input']")
        ?.focus();
    }, 50);
  }, [curated, model.id, onModelChange, setOpen]);

  const option = (
    <ModelSelectorItem
      aria-disabled={!curated}
      className={cn(
        "flex w-full transition-colors",
        model.id === selectedModelId &&
          "border-b border-dashed border-foreground/50",
        curated
          ? "data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
          : "cursor-not-allowed opacity-40 data-[selected=true]:bg-transparent data-[selected=true]:opacity-60 data-[selected=true]:ring-1 data-[selected=true]:ring-muted-foreground/30 data-[selected=true]:ring-inset"
      )}
      onSelect={handleSelect}
      value={model.id}
    >
      <ModelSelectorLogo provider={logoProvider} />
      <ModelSelectorName>{model.name}</ModelSelectorName>
      <div className="ml-auto flex items-center gap-2 text-foreground/70">
        {capabilities?.[model.id]?.tools
          ? maybeWithTooltip(
              <WrenchIcon className="size-3.5" />,
              "Supports tool use"
            )
          : null}
        {capabilities?.[model.id]?.vision
          ? maybeWithTooltip(
              <EyeIcon className="size-3.5" />,
              "Supports vision"
            )
          : null}
        {capabilities?.[model.id]?.reasoning
          ? maybeWithTooltip(
              <BrainIcon className="size-3.5" />,
              "Supports reasoning"
            )
          : null}
        {!curated && <LockIcon className="size-3 text-muted-foreground/50" />}
      </div>
    </ModelSelectorItem>
  );

  if (curated) {
    return option;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-full cursor-not-allowed">{option}</div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        This model is not available in the demo.
      </TooltipContent>
    </Tooltip>
  );
}

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: modelsData } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    { dedupingInterval: 3_600_000, revalidateOnFocus: false }
  );

  const capabilities: Record<string, ModelCapabilities> | undefined =
    modelsData?.capabilities ?? modelsData;
  const dynamicModels: ChatModel[] | undefined = modelsData?.models;
  const activeModels = dynamicModels ?? chatModels;

  const selectedModel =
    activeModels.find((m: ChatModel) => m.id === selectedModelId) ??
    activeModels.find((m: ChatModel) => m.id === DEFAULT_CHAT_MODEL) ??
    activeModels[0];
  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button
          className="h-9 max-w-[200px] justify-between gap-1.5 rounded-lg border-0 bg-transparent px-2 text-[15px] font-normal text-foreground shadow-none transition-colors hover:bg-muted"
          data-testid="model-selector"
          variant="ghost"
        >
          <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
          <ChevronDownIcon size={14} />
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent commandDefaultValue={selectedModel.id}>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          {(() => {
            const curatedIds = new Set(chatModels.map((m) => m.id));
            const allModels = dynamicModels
              ? [
                  ...chatModels,
                  ...dynamicModels.filter((m) => !curatedIds.has(m.id)),
                ]
              : chatModels;

            const grouped: Record<
              string,
              { model: ChatModel; curated: boolean }[]
            > = {};
            for (const model of allModels) {
              const key = curatedIds.has(model.id)
                ? "_available"
                : model.provider;
              if (!grouped[key]) {
                grouped[key] = [];
              }
              grouped[key].push({ curated: curatedIds.has(model.id), model });
            }

            const sortedKeys = Object.keys(grouped).sort((a, b) => {
              if (a === "_available") {
                return -1;
              }
              if (b === "_available") {
                return 1;
              }
              return a.localeCompare(b);
            });

            const providerNames: Record<string, string> = {
              alibaba: "Alibaba",
              anthropic: "Anthropic",
              "arcee-ai": "Arcee AI",
              bytedance: "ByteDance",
              cohere: "Cohere",
              deepseek: "DeepSeek",
              google: "Google",
              inception: "Inception",
              kwaipilot: "Kwaipilot",
              meituan: "Meituan",
              meta: "Meta",
              minimax: "MiniMax",
              mistral: "Mistral",
              moonshotai: "Moonshot",
              morph: "Morph",
              nvidia: "Nvidia",
              openai: "OpenAI",
              perplexity: "Perplexity",
              "prime-intellect": "Prime Intellect",
              xai: "xAI",
              xiaomi: "Xiaomi",
              zai: "Zai",
            };

            return sortedKeys.map((key) => (
              <ModelSelectorGroup
                heading={
                  key === "_available"
                    ? "Available"
                    : (providerNames[key] ?? key)
                }
                key={key}
              >
                {grouped[key].map(({ model, curated }) => (
                  <ModelSelectorOption
                    capabilities={capabilities}
                    curated={curated}
                    key={model.id}
                    model={model}
                    onModelChange={onModelChange}
                    selectedModelId={selectedModel.id}
                    setOpen={setOpen}
                  />
                ))}
              </ModelSelectorGroup>
            ));
          })()}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  const { translate } = usePreferences();
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      stop();
      setMessages((messages) => messages);
    },
    [setMessages, stop]
  );

  return (
    <Button
      aria-label={translate("停止生成", "Stop generating")}
      className="size-10 rounded-full bg-primary p-1 text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/50"
      data-testid="stop-button"
      onClick={handleClick}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
