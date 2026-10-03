"use client";

import {
  GlobeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlugIcon,
  PlusIcon,
  TerminalIcon,
  Trash2Icon,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { usePreferences } from "@/components/preferences-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type McpServerView = {
  args: string[];
  command: string | null;
  description: string;
  enabled: boolean;
  env: Record<string, string>;
  headers: Record<string, string>;
  id: string;
  name: string;
  transport: "stdio" | "http";
  url: string | null;
};

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

async function requestJson(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      id?: string;
    } | null;
    return response.ok
      ? { data: body }
      : {
          error: body?.error ?? "management.somethingWentWrongTryAgainLater",
        };
  } catch {
    return { error: "management.networkErrorTryAgainLater" };
  }
}

function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** 一行一条 KEY=VALUE；返回 null 表示存在格式错误 */
function parseKeyValueLines(text: string): {
  error: boolean;
  value: Record<string, string>;
} {
  const value: Record<string, string> = {};
  for (const line of parseLines(text)) {
    const eq = line.indexOf("=");
    if (eq <= 0) {
      return { error: true, value: {} };
    }
    value[line.slice(0, eq).trim()] = line.slice(eq + 1);
  }
  return { error: false, value };
}

function serializeKeyValue(record: Record<string, string>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

type McpServerFormValues = {
  args: string[];
  command: string;
  description: string;
  enabled: boolean;
  env: Record<string, string>;
  headers: Record<string, string>;
  name: string;
  transport: "stdio" | "http";
  url: string;
};

export function McpServersPage({
  initialServers,
}: {
  initialServers: McpServerView[];
}) {
  const { t } = usePreferences();
  const endpoint = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/admin/mcp-servers`;
  const [servers, setServers] = useState(initialServers);
  const [dialogServer, setDialogServer] = useState<McpServerView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<McpServerView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await requestJson(endpoint);
    if ("error" in result && result.error) {
      toast.error(t(result.error));
      return;
    }
    const data = result.data as { servers?: McpServerView[] } | null;
    setServers(data?.servers ?? []);
  }, [endpoint, t]);

  const handleToggle = useCallback(
    async (server: McpServerView) => {
      setTogglingId(server.id);
      const result = await requestJson(`${endpoint}/${server.id}`, {
        body: JSON.stringify({ enabled: !server.enabled }),
        method: "PATCH",
      });
      if ("error" in result && result.error) {
        toast.error(t(result.error));
      } else {
        setServers((current) =>
          current.map((item) =>
            item.id === server.id ? { ...item, enabled: !server.enabled } : item
          )
        );
        toast.success(
          server.enabled
            ? t("mcpServers.serverDisabled", { name: server.name })
            : t("mcpServers.serverEnabled", { name: server.name })
        );
      }
      setTogglingId(null);
    },
    [endpoint, t]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    const result = await requestJson(`${endpoint}/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if ("error" in result && result.error) {
      toast.error(t(result.error));
    } else {
      setServers((current) =>
        current.filter((item) => item.id !== deleteTarget.id)
      );
      toast.success(t("mcpServers.serverDeleted", { name: deleteTarget.name }));
      setDeleteTarget(null);
    }
    setDeleting(false);
  }, [deleteTarget, endpoint, t]);

  const handleCreate = useCallback(() => {
    setDialogServer(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((server: McpServerView) => {
    setDialogServer(server);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setDialogServer(null);
  }, []);

  const handleDialogSubmit = useCallback(
    async (values: McpServerFormValues) => {
      const body = {
        args: values.transport === "stdio" ? values.args : [],
        command: values.transport === "stdio" ? values.command : null,
        description: values.description,
        enabled: values.enabled,
        env: values.transport === "stdio" ? values.env : {},
        headers: values.transport === "http" ? values.headers : {},
        name: values.name,
        transport: values.transport,
        url: values.transport === "http" ? values.url : null,
      };
      const result = dialogServer
        ? await requestJson(`${endpoint}/${dialogServer.id}`, {
            body: JSON.stringify(body),
            method: "PATCH",
          })
        : await requestJson(endpoint, {
            body: JSON.stringify(body),
            method: "POST",
          });
      if ("error" in result && result.error) {
        toast.error(t(result.error));
        return false;
      }
      toast.success(
        dialogServer
          ? t("mcpServers.serverUpdated", { name: values.name })
          : t("mcpServers.serverCreated", { name: values.name })
      );
      setDialogOpen(false);
      setDialogServer(null);
      await refresh();
      return true;
    },
    [dialogServer, endpoint, refresh, t]
  );

  const handleDeleteRequest = useCallback(
    (server: McpServerView) => setDeleteTarget(server),
    []
  );

  const handleDeleteDialogChange = useCallback(
    (open: boolean) => {
      if (!open && !deleting) {
        setDeleteTarget(null);
      }
    },
    [deleting]
  );

  const handleConfirmDelete = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      handleDelete();
    },
    [handleDelete]
  );

  return (
    <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-[960px]">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">
              {t("management.mcpServicesTitle")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("management.mcpServicesDescription")}
            </p>
          </div>
          <Button className="w-fit px-4" onClick={handleCreate}>
            <PlusIcon data-icon="inline-start" />
            {t("mcpServers.addServer")}
          </Button>
        </header>

        <p className="mt-3 text-[13px] text-muted-foreground">
          {t("mcpServers.workspaceHint")}
        </p>

        {servers.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="overflow-x-auto">
              <table
                aria-label={t("mcpServers.serverList")}
                className="w-full min-w-[760px] text-left text-sm"
              >
                <thead className="bg-muted/50 text-[13px] text-muted-foreground">
                  <tr>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("mcpServers.colName")}
                    </th>
                    <th className="h-10 w-24 px-4 font-medium" scope="col">
                      {t("mcpServers.colTransport")}
                    </th>
                    <th className="h-10 px-4 font-medium" scope="col">
                      {t("mcpServers.colTarget")}
                    </th>
                    <th className="h-10 w-28 px-4 font-medium" scope="col">
                      {t("common.status")}
                    </th>
                    <th
                      className="h-10 w-14 px-4 text-right font-medium"
                      scope="col"
                    >
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {servers.map((server) => (
                    <McpServerRow
                      key={server.id}
                      onEdit={handleEdit}
                      onRequestDelete={handleDeleteRequest}
                      onToggle={handleToggle}
                      server={server}
                      toggling={togglingId === server.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-[14px] border border-border bg-card px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
              <PlugIcon className="size-5" />
            </span>
            <p className="mt-4 text-sm font-medium">
              {t("mcpServers.emptyTitle")}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t("mcpServers.emptyDescription")}
            </p>
            <Button className="mt-5" onClick={handleCreate} variant="outline">
              <PlusIcon data-icon="inline-start" />
              {t("mcpServers.addServer")}
            </Button>
          </div>
        )}
      </div>

      <McpServerDialog
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
        open={dialogOpen}
        server={dialogServer}
      />

      <AlertDialog
        onOpenChange={handleDeleteDialogChange}
        open={Boolean(deleteTarget)}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("mcpServers.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("mcpServers.deleteDescription", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleConfirmDelete}
              variant="destructive"
            >
              {deleting ? t("common.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function McpServerRow({
  onEdit,
  onRequestDelete,
  onToggle,
  server,
  toggling,
}: {
  onEdit: (server: McpServerView) => void;
  onRequestDelete: (server: McpServerView) => void;
  onToggle: (server: McpServerView) => void;
  server: McpServerView;
  toggling: boolean;
}) {
  const { t } = usePreferences();
  const handleEdit = useCallback(() => onEdit(server), [onEdit, server]);
  const handleDelete = useCallback(
    () => onRequestDelete(server),
    [onRequestDelete, server]
  );
  const handleToggle = useCallback(() => onToggle(server), [onToggle, server]);

  const target =
    server.transport === "stdio" ? (
      <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[13px] text-muted-foreground">
        <TerminalIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">
          {server.command}
          {server.args.length > 0
            ? ` ${t("mcpServers.argsCount", { count: server.args.length })}`
            : ""}
        </span>
      </span>
    ) : (
      <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[13px] text-muted-foreground">
        <GlobeIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{server.url}</span>
      </span>
    );

  return (
    <tr className="border-t border-border/70 align-middle transition-colors hover:bg-muted/30">
      <td className="px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "truncate text-[14px] leading-5 font-medium",
                server.enabled ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {server.name}
            </span>
          </div>
          {server.description ? (
            <p className="mt-0.5 line-clamp-1 text-[13px] leading-5 text-muted-foreground">
              {server.description}
            </p>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <Badge variant={server.transport === "stdio" ? "secondary" : "outline"}>
          {server.transport === "stdio"
            ? t("mcpServers.transportStdio")
            : t("mcpServers.transportHttp")}
        </Badge>
      </td>
      <td className="max-w-[280px] px-4 py-3.5">{target}</td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Switch
            aria-label={t("mcpServers.toggleServer", { name: server.name })}
            checked={server.enabled}
            disabled={toggling}
            onCheckedChange={handleToggle}
          />
          <span
            className={cn(
              "text-[13px] leading-5 whitespace-nowrap",
              server.enabled ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {server.enabled ? t("common.enabled") : t("mcpServers.disabled")}
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        <DropdownMenu modal>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("common.moreActions")}
              className="text-muted-foreground data-[state=open]:bg-muted hover:text-foreground"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom">
            <DropdownMenuItem className="cursor-pointer" onClick={handleEdit}>
              <PencilIcon />
              <span>{t("mcpServers.editAction")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={handleDelete}
              variant="destructive"
            >
              <Trash2Icon />
              <span>{t("common.delete")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function McpServerDialog({
  onClose,
  onSubmit,
  open,
  server,
}: {
  onClose: () => void;
  onSubmit: (values: McpServerFormValues) => Promise<boolean>;
  open: boolean;
  server: McpServerView | null;
}) {
  const { t } = usePreferences();
  const isEdit = server !== null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transport, setTransport] = useState<"stdio" | "http">("stdio");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const [envText, setEnvText] = useState("");
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(server?.name ?? "");
      setDescription(server?.description ?? "");
      setTransport(server?.transport ?? "stdio");
      setCommand(server?.command ?? "");
      setArgsText((server?.args ?? []).join("\n"));
      setEnvText(serializeKeyValue(server?.env ?? {}));
      setUrl(server?.url ?? "");
      setHeadersText(serializeKeyValue(server?.headers ?? {}));
      setEnabled(server?.enabled ?? true);
    }
  }, [open, server]);

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setName(event.currentTarget.value),
    []
  );
  const handleDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setDescription(event.currentTarget.value),
    []
  );
  const handleCommandChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setCommand(event.currentTarget.value),
    []
  );
  const handleArgsChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setArgsText(event.currentTarget.value),
    []
  );
  const handleEnvChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setEnvText(event.currentTarget.value),
    []
  );
  const handleUrlChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setUrl(event.currentTarget.value),
    []
  );
  const handleHeadersChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setHeadersText(event.currentTarget.value),
    []
  );
  const handleTransport = useCallback(
    (next: "stdio" | "http") => () => setTransport(next),
    []
  );
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();
      if (!trimmedName) {
        toast.error(t("mcpServers.nameRequired"));
        return;
      }
      if (!NAME_PATTERN.test(trimmedName)) {
        toast.error(t("mcpServers.invalidName"));
        return;
      }
      if (transport === "stdio" && !command.trim()) {
        toast.error(t("mcpServers.commandRequired"));
        return;
      }
      if (transport === "http" && !/^https?:\/\//.test(url.trim())) {
        toast.error(t("mcpServers.urlRequired"));
        return;
      }
      const env = parseKeyValueLines(envText);
      if (transport === "stdio" && env.error) {
        toast.error(t("mcpServers.invalidKeyValue"));
        return;
      }
      const headers = parseKeyValueLines(headersText);
      if (transport === "http" && headers.error) {
        toast.error(t("mcpServers.invalidKeyValue"));
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({
          args: parseLines(argsText),
          command: command.trim(),
          description: description.trim(),
          enabled,
          env: env.value,
          headers: headers.value,
          name: trimmedName,
          transport,
          url: url.trim(),
        });
      } finally {
        setSubmitting(false);
      }
    },
    [
      argsText,
      command,
      description,
      enabled,
      envText,
      headersText,
      name,
      onSubmit,
      t,
      transport,
      url,
    ]
  );

  const transportOptions = useMemo(
    () => [
      {
        description: t("mcpServers.transportStdioDescription"),
        icon: TerminalIcon,
        key: "stdio" as const,
        label: t("mcpServers.transportStdioTitle"),
      },
      {
        description: t("mcpServers.transportHttpDescription"),
        icon: GlobeIcon,
        key: "http" as const,
        label: t("mcpServers.transportHttpTitle"),
      },
    ],
    [t]
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="gap-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEdit ? t("mcpServers.editTitle") : t("mcpServers.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("mcpServers.dialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="mcp-server-name">{t("mcpServers.fieldName")}</Label>
            <Input
              disabled={isEdit}
              id="mcp-server-name"
              onChange={handleNameChange}
              placeholder={t("mcpServers.fieldNamePlaceholder")}
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mcp-server-description">
              {t("mcpServers.fieldDescription")}
            </Label>
            <Input
              id="mcp-server-description"
              onChange={handleDescriptionChange}
              placeholder={t("mcpServers.fieldDescriptionPlaceholder")}
              value={description}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("mcpServers.fieldTransport")}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {transportOptions.map((option) => {
                const Icon = option.icon;
                const active = transport === option.key;
                return (
                  <button
                    className={cn(
                      "flex min-h-20 w-full flex-col items-start rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors",
                      active
                        ? "border-primary/60 bg-primary/5"
                        : "hover:bg-muted/45"
                    )}
                    key={option.key}
                    onClick={handleTransport(option.key)}
                    type="button"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon aria-hidden="true" className="size-4" />
                      {option.label}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {transport === "stdio" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="mcp-server-command">
                  {t("mcpServers.fieldCommand")}
                </Label>
                <Input
                  id="mcp-server-command"
                  onChange={handleCommandChange}
                  placeholder={t("mcpServers.fieldCommandPlaceholder")}
                  value={command}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mcp-server-args">
                  {t("mcpServers.fieldArgs")}
                </Label>
                <Textarea
                  id="mcp-server-args"
                  onChange={handleArgsChange}
                  placeholder={t("mcpServers.fieldArgsPlaceholder")}
                  rows={3}
                  value={argsText}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mcp-server-env">
                  {t("mcpServers.fieldEnv")}
                </Label>
                <Textarea
                  id="mcp-server-env"
                  onChange={handleEnvChange}
                  placeholder={t("mcpServers.fieldEnvPlaceholder")}
                  rows={3}
                  value={envText}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="mcp-server-url">
                  {t("mcpServers.fieldUrl")}
                </Label>
                <Input
                  id="mcp-server-url"
                  onChange={handleUrlChange}
                  placeholder={t("mcpServers.fieldUrlPlaceholder")}
                  value={url}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mcp-server-headers">
                  {t("mcpServers.fieldHeaders")}
                </Label>
                <Textarea
                  id="mcp-server-headers"
                  onChange={handleHeadersChange}
                  placeholder={t("mcpServers.fieldHeadersPlaceholder")}
                  rows={3}
                  value={headersText}
                />
              </div>
            </>
          )}
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {t("mcpServers.fieldEnabled")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("mcpServers.fieldEnabledHint")}
              </p>
            </div>
            <Switch
              aria-label={t("mcpServers.fieldEnabled")}
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <DialogFooter>
            <Button disabled={submitting} onClick={onClose} variant="outline">
              {t("common.cancel")}
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? <Spinner /> : null}
              {isEdit
                ? t("mcpServers.submitSave")
                : t("mcpServers.submitCreate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
