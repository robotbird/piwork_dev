"use client";

import { format, formatDistance } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { ContainerIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { SandboxRuntimeConfig } from "@/lib/runtime/sandbox";
import { cn } from "@/lib/utils";

export type SandboxInstanceClientView = {
  chatId: string;
  chatTitle: string | null;
  createdAt: string;
  expiresAt: string;
  externalId: string;
  id: string;
  image: string;
  lastRenewedAt: string;
  lastRunId: string | null;
  provider: "test" | "docker" | "opensandbox";
  status:
    | "creating"
    | "ready"
    | "paused"
    | "degraded"
    | "destroyed"
    | "expired";
  runtimeConfig: SandboxRuntimeConfig | null;
  ttlSeconds: number;
  userEmail: string | null;
  userId: string;
  userName: string | null;
  observedAt: string | null;
  syncError: boolean;
  controllable: boolean;
};

type Status = SandboxInstanceClientView["status"];
const LABELS: Record<Status, string> = {
  creating: "statusCreating",
  degraded: "statusDegraded",
  destroyed: "statusDestroyed",
  expired: "statusExpired",
  paused: "statusPaused",
  ready: "statusReady",
};
const TERMINAL = new Set<Status>(["destroyed", "expired"]);
type Filter = "all" | "active" | "error" | "destroyed";
const FILTERS: Filter[] = ["all", "active", "error", "destroyed"];

function preventOutside(event: Event) {
  event.preventDefault();
}

function StatusLabel({ item }: { item: SandboxInstanceClientView }) {
  const { t } = usePreferences();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap text-[13px]",
        item.syncError || item.status === "degraded"
          ? "text-red-500"
          : item.status === "ready"
            ? "text-blue-500"
            : "text-muted-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full bg-current"
      />
      {t(`sandboxes.${item.syncError ? "statusUnknown" : LABELS[item.status]}`)}
    </span>
  );
}

function DetailGroup({
  title,
  entries,
}: {
  title: string;
  entries: [string, React.ReactNode][];
}) {
  return (
    <section className="rounded-lg border border-border/70 p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <dl className="space-y-2 text-sm">
        {entries.map(([key, value]) => (
          <div className="grid grid-cols-[105px_minmax(0,1fr)] gap-3" key={key}>
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="min-w-0 break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SandboxDetails({
  item,
  busy,
  onRenew,
  onDestroy,
}: {
  item: SandboxInstanceClientView;
  busy: boolean;
  onRenew: () => void;
  onDestroy: () => void;
}) {
  const { t } = usePreferences();
  const config = item.runtimeConfig;
  const unknown = t("sandboxes.unknown");
  const docker = item.provider === "docker";
  const supported = item.provider !== "test";
  const canRenew =
    item.controllable &&
    !item.syncError &&
    ["ready", "paused"].includes(item.status);
  const security = (yes: boolean) =>
    supported && config
      ? t(`sandboxes.${yes ? "enabled" : "notGuaranteed"}`)
      : unknown;
  return (
    <>
      <div className="border-b border-border/60 px-6 pb-5 pt-8 sm:pt-18">
        <Dialog.Title className="text-xl font-semibold">
          {t("sandboxes.detailsTitle")}
        </Dialog.Title>
        <Dialog.Description className="sr-only">
          {t("sandboxes.detailsDescription")}
        </Dialog.Description>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span
            className="max-w-[230px] truncate font-mono text-lg font-semibold"
            title={item.externalId}
          >
            {item.externalId}
          </span>
          <StatusLabel item={item} />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {Boolean(item.syncError) && (
          <p
            className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            role="status"
          >
            {t("sandboxes.syncError")}
          </p>
        )}
        <DetailGroup
          entries={[
            [
              t("sandboxes.colUser"),
              item.userName || item.userEmail || item.userId,
            ],
            ["Chat ID", item.chatId],
            ["Run ID", item.lastRunId || "—"],
            [
              "Provider",
              item.provider === "opensandbox"
                ? "OpenSandbox"
                : docker
                  ? "Docker"
                  : "Test",
            ],
            [t("common.status"), <StatusLabel item={item} key="status" />],
          ]}
          title={t("sandboxes.basicInfo")}
        />
        <DetailGroup
          entries={[
            [t("sandboxes.image"), item.image],
            ["Workspace", config?.workspaceRoot || unknown],
            ["CPU", config ? `${config.resource.cpuCores} Core` : unknown],
            [
              t("sandboxes.memory"),
              config ? `${config.resource.memoryMB / 1024} GB` : unknown,
            ],
            ["TTL", t("sandboxes.ttlSeconds", { seconds: item.ttlSeconds })],
            [
              t("sandboxes.colExpires"),
              format(new Date(item.expiresAt), "yyyy-MM-dd HH:mm:ss"),
            ],
            [
              t("sandboxes.createdAt"),
              format(new Date(item.createdAt), "yyyy-MM-dd HH:mm:ss"),
            ],
          ]}
          title={t("sandboxes.runtimeConfig")}
        />
        <DetailGroup
          entries={[
            [
              "RootFS",
              config && supported
                ? t(`sandboxes.${docker ? "readOnly" : "writable"}`)
                : unknown,
            ],
            ["Workspace", config ? t("sandboxes.writable") : unknown],
            [
              t("sandboxes.network"),
              config
                ? config.egress.mode === "deny-all"
                  ? "deny-all"
                  : `allowlist: ${config.egress.fqdns.join(", ")}`
                : unknown,
            ],
            [t("sandboxes.privileges"), security(docker)],
            ["Capabilities", docker && config ? "dropped" : unknown],
            ["/tmp", docker && config ? "tmpfs" : unknown],
          ]}
          title={t("sandboxes.securityBaseline")}
        />
        {config && !docker && supported && (
          <p className="text-xs leading-5 text-muted-foreground">
            {t("sandboxes.openSandboxBaselineNote")}
          </p>
        )}
        {config?.egress.mode === "allowlist" && (
          <p className="text-xs leading-5 text-muted-foreground">
            {t("sandboxes.egressNote")}
          </p>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          {item.observedAt
            ? t("sandboxes.lastObserved", {
                time: format(new Date(item.observedAt), "HH:mm:ss"),
              })
            : t("sandboxes.notObserved")}
        </p>
      </div>
      <div className="border-t border-border/60 bg-background px-6 py-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild className="flex-1" size="sm" variant="outline">
            <Link href={`/chat/${item.chatId}?sandbox=${item.id}`}>
              {t("sandboxes.viewTask")}
            </Link>
          </Button>
          <Button
            className="flex-1"
            disabled={busy || !canRenew}
            onClick={onRenew}
            size="sm"
            variant="outline"
          >
            {busy ? <Spinner /> : null}
            {t("sandboxes.extendHour")}
          </Button>
          <Button
            className="flex-1 bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            disabled={busy || !item.controllable}
            onClick={onDestroy}
            size="sm"
            variant="destructive"
          >
            {t("sandboxes.destroySandbox")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("sandboxes.destroyHint")}
        </p>
      </div>
    </>
  );
}

export function SandboxesPage({
  initialInstances,
}: {
  initialInstances: SandboxInstanceClientView[];
}) {
  const { t, language } = usePreferences();
  const endpoint = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/management/sandboxes`;
  const [instances, setInstances] = useState(initialInstances);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destroyTarget, setDestroyTarget] =
    useState<SandboxInstanceClientView | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compact, setCompact] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const inFlight = useRef(false);
  const mutation = useRef(false);
  const locale = language === "zh" ? zhCN : enUS;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current || mutation.current) {
      return;
    }
    inFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Refresh failed");
      }
      const body = (await response.json()) as {
        instances: SandboxInstanceClientView[];
      };
      setInstances(body.instances);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [endpoint]);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, 10_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const act = useCallback(
    async (item: SandboxInstanceClientView, action: "renew" | "destroy") => {
      if (mutation.current || inFlight.current) {
        return;
      }
      mutation.current = true;
      setBusy(true);
      try {
        const response = await fetch(endpoint, {
          body: JSON.stringify({
            action,
            externalId: item.externalId,
            provider: item.provider,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const body = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(
            body.error || t("management.somethingWentWrongTryAgainLater")
          );
        }
        if (action === "destroy") {
          setInstances((current) =>
            current.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    controllable: false,
                    status: "destroyed",
                    syncError: false,
                  }
                : row
            )
          );
          setDestroyTarget(null);
        }
        toast.success(
          t(
            `sandboxes.${action === "renew" ? "renewedToast" : "destroyedToast"}`
          )
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("management.networkErrorTryAgainLater")
        );
      } finally {
        mutation.current = false;
        setBusy(false);
        refresh();
      }
    },
    [endpoint, refresh, t]
  );

  const selected = instances.find((row) => row.id === selectedId);
  const search = query.trim().toLocaleLowerCase();
  const rows = instances.filter((item) => {
    const error = item.syncError || item.status === "degraded";
    if (filter === "active" && (TERMINAL.has(item.status) || error)) {
      return false;
    }
    if (filter === "error" && !error) {
      return false;
    }
    if (filter === "destroyed" && !TERMINAL.has(item.status)) {
      return false;
    }
    return (
      !search ||
      [
        item.externalId,
        item.id,
        item.userName,
        item.userEmail,
        item.userId,
        item.chatId,
        item.chatTitle,
        item.lastRunId,
        item.provider,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search)
    );
  });

  const handleQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );
  const handleFilter = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setFilter(event.currentTarget.dataset.filter as Filter),
    []
  );
  const handleSelect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setSelectedId(event.currentTarget.dataset.instanceId || null),
    []
  );
  const handleDetailsOpen = useCallback((open: boolean) => {
    if (!open) {
      setSelectedId(null);
    }
  }, []);
  const handleDestroyRequest = useCallback(() => {
    if (selected) {
      setDestroyTarget(selected);
    }
  }, [selected]);
  const handleRenew = useCallback(() => {
    if (selected) {
      act(selected, "renew");
    }
  }, [act, selected]);
  const handleConfirmationOpen = useCallback(
    (open: boolean) => {
      if (!open && !busy) {
        setDestroyTarget(null);
      }
    },
    [busy]
  );
  const handleConfirm = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (destroyTarget) {
        act(destroyTarget, "destroy");
      }
    },
    [act, destroyTarget]
  );

  return (
    <section
      className={cn(
        "min-w-0 px-5 pb-8 pt-8 transition-[margin] sm:pt-18 sm:px-8 lg:px-9",
        selected && "xl:mr-[440px]"
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight">Sandbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("management.sandboxManagementDescription")}
          </p>
        </div>
        <Button
          aria-label={t("sandboxes.refresh")}
          disabled={refreshing || busy}
          onClick={refresh}
          size="icon-sm"
          variant="ghost"
        >
          {refreshing ? <Spinner /> : <RefreshCwIcon className="size-4" />}
        </Button>
      </header>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label={t("sandboxes.searchPlaceholder")}
            className="h-10 pl-9"
            onChange={handleQuery}
            placeholder={t("sandboxes.searchPlaceholder")}
            type="search"
            value={query}
          />
        </div>
        <fieldset
          aria-label={t("sandboxes.filterStatusLabel")}
          className="flex rounded-full bg-muted/60 p-1"
        >
          {FILTERS.map((value) => (
            <button
              aria-pressed={filter === value}
              className={cn(
                "min-w-16 rounded-full px-4 py-1.5 text-[13px] text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                filter === value && "bg-background text-foreground shadow-sm"
              )}
              data-filter={value}
              key={value}
              onClick={handleFilter}
              type="button"
            >
              {t(`sandboxes.filter${value[0].toUpperCase()}${value.slice(1)}`)}
            </button>
          ))}
        </fieldset>
      </div>
      {(fetchError || instances.some((item) => item.syncError)) && (
        <p
          className="mt-4 text-xs text-amber-700 dark:text-amber-300"
          role="status"
        >
          {t(fetchError ? "sandboxes.refreshError" : "sandboxes.syncError")}
        </p>
      )}
      <div className="mt-6 rounded-xl border border-border/70 bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-4 pt-1">
          <h2 className="text-sm font-medium">
            {t("sandboxes.currentCount", { count: rows.length })}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t("sandboxes.autoRefresh")}
          </span>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table
              aria-label={t("sandboxes.instanceList")}
              className="w-full min-w-[760px] text-left text-sm"
            >
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  {[
                    "colSandbox",
                    "colUser",
                    "colChat",
                    "colProvider",
                    "colStatus",
                    "colResource",
                    "colExpires",
                    "colActions",
                  ].map((key) => (
                    <th
                      className="h-10 whitespace-nowrap px-3 font-medium"
                      key={key}
                      scope="col"
                    >
                      {t(`sandboxes.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr
                    className={cn(
                      "border-t border-border/50",
                      selectedId === item.id
                        ? "bg-blue-50/70 dark:bg-blue-950/30"
                        : "hover:bg-muted/30"
                    )}
                    key={item.id}
                  >
                    <td className="max-w-44 px-3 py-4">
                      <button
                        className="block max-w-44 truncate text-left font-mono text-xs font-medium hover:text-blue-500"
                        data-instance-id={item.id}
                        onClick={handleSelect}
                        title={item.externalId}
                        type="button"
                      >
                        {item.externalId}
                      </button>
                    </td>
                    <td
                      className="max-w-32 truncate px-3 py-4"
                      title={item.userEmail || item.userId}
                    >
                      {item.userName || item.userEmail || item.userId}
                    </td>
                    <td
                      className="max-w-36 truncate px-3 py-4"
                      title={item.chatTitle || item.chatId}
                    >
                      {item.chatTitle || item.chatId}
                    </td>
                    <td className="px-3 py-4">
                      {item.provider === "opensandbox"
                        ? "OpenSandbox"
                        : item.provider === "docker"
                          ? "Docker"
                          : "Test"}
                    </td>
                    <td className="px-3 py-4">
                      <StatusLabel item={item} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs">
                      {item.runtimeConfig
                        ? `${item.runtimeConfig.resource.cpuCores}C · ${item.runtimeConfig.resource.memoryMB / 1024}GB`
                        : "—"}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-4 text-xs"
                      title={format(
                        new Date(item.expiresAt),
                        "yyyy-MM-dd HH:mm:ss"
                      )}
                    >
                      {TERMINAL.has(item.status)
                        ? "—"
                        : now
                          ? formatDistance(new Date(item.expiresAt), now, {
                              addSuffix: true,
                              locale,
                            })
                          : format(new Date(item.expiresAt), "HH:mm")}
                    </td>
                    <td className="px-3 py-4">
                      <button
                        className="whitespace-nowrap text-xs font-medium text-blue-500 hover:underline"
                        data-instance-id={item.id}
                        onClick={handleSelect}
                        type="button"
                      >
                        {t("sandboxes.view")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-14 text-center">
            <ContainerIcon className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">
              {t(
                instances.length
                  ? "sandboxes.noMatches"
                  : "sandboxes.emptyTitle"
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("sandboxes.emptyDescription")}
            </p>
          </div>
        )}
      </div>
      <Dialog.Root
        modal={compact}
        onOpenChange={handleDetailsOpen}
        open={Boolean(selected)}
      >
        <Dialog.Portal>
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border/70 bg-background shadow-xl sm:w-[440px] xl:shadow-none"
            onInteractOutside={preventOutside}
          >
            {selected && (
              <SandboxDetails
                busy={busy || refreshing}
                item={selected}
                onDestroy={handleDestroyRequest}
                onRenew={handleRenew}
              />
            )}
            <Dialog.Close asChild>
              <Button
                aria-label={t("common.close")}
                className="absolute right-5 top-6 sm:top-18"
                size="icon-sm"
                variant="ghost"
              >
                <XIcon className="size-4" />
              </Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AlertDialog
        onOpenChange={handleConfirmationOpen}
        open={Boolean(destroyTarget)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sandboxes.destroyTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("sandboxes.destroyDescription", {
                externalId: destroyTarget?.externalId || "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || refreshing}
              onClick={handleConfirm}
              variant="destructive"
            >
              {busy ? <Spinner /> : null}
              {t("sandboxes.destroyAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
