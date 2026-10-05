"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BotIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  SearchIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type {
  ConversationDetail,
  ConversationFilters,
  ConversationList,
  ConversationMessage,
  ConversationRecord,
} from "@/lib/admin/conversations";
import { cn } from "@/lib/utils";

async function load<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, ReactNode][];
  onChange: (value: string) => void;
}) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label={label} className="min-w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function Status({ status }: { status: ConversationRecord["status"] }) {
  const t = useTranslations("conversations");
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px]">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "failed"
            ? "bg-destructive"
            : status === "none" || status === "aborted"
              ? "bg-muted-foreground"
              : "bg-link"
        )}
      />
      {t(`status.${status}`)}
    </span>
  );
}

function Messages({
  messages,
  preview = false,
}: {
  messages: ConversationMessage[];
  preview?: boolean;
}) {
  const t = useTranslations("conversations");
  return (
    <div className="flex flex-col gap-5">
      {messages.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("noMessages")}
        </p>
      ) : (
        messages.map((message) => (
          <article className="flex gap-3" key={message.id}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
              {message.role === "assistant" ? (
                <BotIcon className="size-4 text-link" />
              ) : (
                <UserIcon className="size-4 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">
                  {message.role === "assistant"
                    ? t("ai")
                    : message.role === "user"
                      ? t("user")
                      : message.role}
                </span>
                <time className="text-muted-foreground">
                  {stamp(message.createdAt)}
                </time>
              </div>
              <p
                className={cn(
                  "break-words text-[13px] leading-6",
                  preview ? "line-clamp-2" : "whitespace-pre-wrap"
                )}
              >
                {message.text || t("nonText")}
              </p>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function ProviderLogo({ providerKey }: { providerKey: string | null }) {
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const handleError = useCallback(
    () => setFailedFor(providerKey),
    [providerKey]
  );
  return providerKey && failedFor !== providerKey ? (
    <Image
      alt=""
      aria-hidden
      className="size-5 shrink-0 object-contain"
      height={20}
      onError={handleError}
      src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models/icon?provider=${encodeURIComponent(providerKey)}`}
      unoptimized
      width={20}
    />
  ) : (
    <BotIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
  );
}

function ModelDetails({
  record,
  compact = false,
}: {
  record: ConversationRecord;
  compact?: boolean;
}) {
  const t = useTranslations("conversations");
  const models = compact
    ? [...new Map(record.models.map((model) => [model.key, model])).values()]
    : record.models;
  return models.length ? (
    <div className="flex flex-col gap-2">
      {models.map((model) => (
        <div
          className="flex items-center gap-2"
          key={`${model.key}:${model.source}`}
        >
          <ProviderLogo providerKey={model.providerKey} />
          <div className="min-w-0">
            <p className="max-w-[220px] truncate" title={model.name}>
              {model.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {model.providerName || t("unknownProvider")}
              {compact ? null : ` · ${t(`modelSource.${model.source}`)}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <span>{t("unknown")}</span>
  );
}

function TokenTotal({ record }: { record: ConversationRecord }) {
  const t = useTranslations("conversations");
  if (!record.usage) {
    return <span>{t("unknown")}</span>;
  }
  const partial =
    record.unrecordedRuns > 0 ||
    record.usageRecordedMessages < record.completedMessages;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {record.usage.totalTokens.toLocaleString("en-US")}
      {partial ? (
        <span className="text-xs text-muted-foreground">{t("partial")}</span>
      ) : null}
    </span>
  );
}

function stamp(value: string) {
  return value.slice(0, 16).replace("T", " ");
}

export function ConversationsPage({
  initialData,
}: {
  initialData: ConversationList;
}) {
  const t = useTranslations("conversations");
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState<ConversationFilters>({
    days: "7",
    model: "all",
    page: 1,
    pageSize: 10,
    project: "all",
    query: "",
    sort: "desc",
    status: "all",
  });
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [full, setFull] = useState(false);
  const [messagePage, setMessagePage] = useState(1);
  const [fullDetail, setFullDetail] = useState<ConversationDetail | null>(null);
  const [fullError, setFullError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((value) =>
          value.query === query.trim()
            ? value
            : { ...value, page: 1, query: query.trim() }
        ),
      300
    );
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError(false);
    const search = new URLSearchParams(
      Object.entries(filters).map(([key, value]) => [key, String(value)])
    );
    load<ConversationList>(
      `/api/admin/conversations?${search}&refresh=${refresh}`,
      controller.signal
    )
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        setData(result);
        setSelected((id) =>
          result.items.some((item) => item.id === id) ? id : null
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBusy(false);
        }
      });
    return () => controller.abort();
  }, [filters, refresh]);
  useEffect(() => {
    setDetail(null);
    setDetailError(false);
    if (!selected) {
      return;
    }
    const controller = new AbortController();
    load<ConversationDetail>(
      `/api/admin/conversations/${selected}?preview=1&refresh=${refresh}`,
      controller.signal
    )
      .then(setDetail)
      .catch(() => {
        if (!controller.signal.aborted) {
          setDetailError(true);
        }
      });
    return () => controller.abort();
  }, [selected, refresh]);
  useEffect(() => {
    setFullDetail(null);
    setFullError(false);
    if (!full || !selected) {
      return;
    }
    const controller = new AbortController();
    load<ConversationDetail>(
      `/api/admin/conversations/${selected}?page=${messagePage}&refresh=${refresh}`,
      controller.signal
    )
      .then(setFullDetail)
      .catch(() => {
        if (!controller.signal.aborted) {
          setFullError(true);
        }
      });
    return () => controller.abort();
  }, [full, selected, messagePage, refresh]);

  const change = useCallback(
    (key: keyof ConversationFilters, value: string | number) => {
      setFilters((current) => ({ ...current, [key]: value, page: 1 }));
    },
    []
  );
  const handleQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    []
  );
  const handleStatus = useCallback(
    (value: string) => change("status", value),
    [change]
  );
  const handleModel = useCallback(
    (value: string) => change("model", value),
    [change]
  );
  const handleProject = useCallback(
    (value: string) => change("project", value),
    [change]
  );
  const handleDays = useCallback(
    (value: string) => change("days", value),
    [change]
  );
  const handlePageSize = useCallback(
    (value: string) => change("pageSize", Number(value)),
    [change]
  );
  const handleRefresh = useCallback(() => setRefresh((value) => value + 1), []);
  const handleSort = useCallback(
    () => change("sort", filters.sort === "desc" ? "asc" : "desc"),
    [change, filters.sort]
  );
  const handleInspect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setSelected(event.currentTarget.dataset.id ?? null),
    []
  );
  const handlePrevious = useCallback(
    () => setFilters((value) => ({ ...value, page: data.page - 1 })),
    [data.page]
  );
  const handleNext = useCallback(
    () => setFilters((value) => ({ ...value, page: data.page + 1 })),
    [data.page]
  );
  const handlePage = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const page = Number(event.currentTarget.dataset.page);
    setFilters((value) => ({ ...value, page }));
  }, []);
  const handleClose = useCallback(() => {
    setSelected(null);
    setFull(false);
  }, []);
  const handleFull = useCallback(() => {
    setMessagePage(1);
    setFull(true);
  }, []);
  const handleCopy = useCallback(async () => {
    if (!selected) {
      return;
    }
    try {
      await navigator.clipboard.writeText(selected);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyError"));
    }
  }, [selected, t]);
  const handleMessagePrevious = useCallback(
    () => setMessagePage((page) => page - 1),
    []
  );
  const handleMessageNext = useCallback(
    () => setMessagePage((page) => page + 1),
    []
  );
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const pageNumbers = Array.from(
    { length: Math.min(5, pages) },
    (_, index) => Math.max(1, Math.min(data.page - 2, pages - 4)) + index
  );
  const headings = [
    "title",
    "user",
    "project",
    "model",
    "updatedAt",
    "messageCount",
    "tokens",
    "state",
    "actions",
  ];
  return (
    <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-7">
        <header>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">
            {t("heading")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-3">
          <InputGroup className="w-full sm:min-w-[260px] sm:flex-1">
            <InputGroupInput
              aria-label={t("search")}
              maxLength={200}
              onChange={handleQuery}
              placeholder={t("search")}
              value={query}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <FilterSelect
            label={t("state")}
            onChange={handleStatus}
            options={[
              ["all", t("allStatuses")],
              ...[
                "none",
                "queued",
                "starting",
                "running",
                "waiting_user",
                "settled",
                "failed",
                "aborted",
              ].map((key): [string, string] => [key, t(`status.${key}`)]),
            ]}
            value={filters.status}
          />
          <FilterSelect
            label={t("project")}
            onChange={handleProject}
            options={[
              ["all", t("allProjects")],
              ["none", t("noProject")],
              ...data.projects.map((item): [string, string] => [
                item.id,
                `${item.name} · ${item.userEmail}`,
              ]),
            ]}
            value={filters.project}
          />
          <FilterSelect
            label={t("model")}
            onChange={handleModel}
            options={[
              ["all", t("allModels")],
              ["none", t("unknown")],
              ...data.models.map((item): [string, ReactNode] => [
                item.key,
                <span className="inline-flex items-center gap-2" key={item.key}>
                  <ProviderLogo providerKey={item.providerKey} />
                  {item.name} · {item.providerName || t("unknownProvider")}
                </span>,
              ]),
            ]}
            value={filters.model}
          />
          <FilterSelect
            label={t("dateRange")}
            onChange={handleDays}
            options={[
              ["7", t("last7")],
              ["30", t("last30")],
              ["90", t("last90")],
              ["all", t("allTime")],
            ]}
            value={filters.days}
          />
          <Button
            aria-label={t("refresh")}
            disabled={busy}
            onClick={handleRefresh}
            size="icon"
            variant="outline"
          >
            {busy ? <Spinner /> : <RefreshCwIcon />}
          </Button>
        </div>
        {Boolean(error) && (
          <p className="text-sm text-destructive" role="alert">
            {t("loadError")}
          </p>
        )}
        <div
          className={cn(
            "grid items-start gap-5",
            selected && "xl:grid-cols-[minmax(0,1fr)_300px]"
          )}
        >
          <div
            aria-busy={busy}
            className="min-w-0 overflow-hidden rounded-[14px] border border-border bg-card"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-border/60">
                  <tr>
                    {headings.map((key) => (
                      <th
                        className="whitespace-nowrap px-4 py-4 font-medium text-muted-foreground"
                        key={key}
                      >
                        {key === "updatedAt" ? (
                          <button
                            className="inline-flex items-center gap-2"
                            onClick={handleSort}
                            type="button"
                          >
                            {t(key)}
                            {filters.sort === "desc" ? (
                              <ArrowDownIcon className="size-3.5" />
                            ) : (
                              <ArrowUpIcon className="size-3.5" />
                            )}
                          </button>
                        ) : (
                          t(key)
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {error ? (
                    <tr>
                      <td
                        className="py-16 text-center text-muted-foreground"
                        colSpan={9}
                      >
                        {t("loadError")}
                      </td>
                    </tr>
                  ) : data.items.length === 0 ? (
                    <tr>
                      <td
                        className="py-16 text-center text-muted-foreground"
                        colSpan={9}
                      >
                        <MessageSquareIcon className="mx-auto mb-3 size-7" />
                        {t("empty")}
                      </td>
                    </tr>
                  ) : (
                    data.items.map((item) => (
                      <tr
                        className={cn(
                          "border-b border-border/60 transition-colors hover:bg-muted/40",
                          selected === item.id && "bg-accent/60"
                        )}
                        key={item.id}
                      >
                        <td className="max-w-[220px] px-4 py-4">
                          <button
                            className="block w-full truncate text-left font-medium hover:text-link"
                            data-id={item.id}
                            onClick={handleInspect}
                            title={item.title}
                            type="button"
                          >
                            {item.title}
                          </button>
                        </td>
                        <td
                          className="max-w-[190px] truncate px-4 py-4 text-muted-foreground"
                          title={item.userEmail}
                        >
                          {item.userEmail}
                        </td>
                        <td className="max-w-[130px] truncate px-4 py-4 text-muted-foreground">
                          {item.projectName || t("noProject")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                          <ModelDetails compact record={item} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                          {stamp(item.updatedAt)}
                        </td>
                        <td className="px-4 py-4 tabular-nums text-muted-foreground">
                          {item.messageCount}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 tabular-nums text-muted-foreground">
                          <TokenTotal record={item} />
                        </td>
                        <td className="px-4 py-4">
                          <Status status={item.status} />
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            data-id={item.id}
                            onClick={handleInspect}
                            size="sm"
                            variant="link"
                          >
                            {t("view")}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
              <span className="text-[13px] text-muted-foreground">
                {t("total", { count: data.total })}
              </span>
              <nav
                aria-label={t("pagination")}
                className="flex items-center gap-1"
              >
                <Button
                  aria-label={t("previous")}
                  disabled={busy || data.page <= 1}
                  onClick={handlePrevious}
                  size="icon"
                  variant="outline"
                >
                  <ChevronLeftIcon />
                </Button>
                {pageNumbers.map((page) => (
                  <Button
                    aria-current={page === data.page ? "page" : undefined}
                    aria-label={t("page", { page })}
                    data-page={page}
                    disabled={busy}
                    key={page}
                    onClick={handlePage}
                    size="icon"
                    variant={page === data.page ? "outline" : "ghost"}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  aria-label={t("next")}
                  disabled={busy || data.page >= pages}
                  onClick={handleNext}
                  size="icon"
                  variant="outline"
                >
                  <ChevronRightIcon />
                </Button>
              </nav>
              <FilterSelect
                label={t("pageSize")}
                onChange={handlePageSize}
                options={[10, 20, 50].map((count) => [
                  String(count),
                  t("perPage", { count }),
                ])}
                value={String(filters.pageSize)}
              />
            </footer>
          </div>
          {Boolean(selected) && (
            <aside className="min-w-0 rounded-[14px] border border-border bg-card">
              <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <h2 className="text-base font-semibold">{t("details")}</h2>
                <Button
                  aria-label={t("close")}
                  onClick={handleClose}
                  size="icon"
                  variant="ghost"
                >
                  <XIcon />
                </Button>
              </header>
              <div className="flex flex-col gap-5 p-5">
                {detailError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {t("loadError")}
                  </p>
                ) : detail ? (
                  <>
                    <dl className="flex flex-col gap-3 text-[13px]">
                      {[
                        [t("title"), detail.record.title],
                        [t("user"), detail.record.userEmail],
                        [
                          t("project"),
                          detail.record.projectName || t("noProject"),
                        ],
                        [
                          t("model"),
                          <ModelDetails key="models" record={detail.record} />,
                        ],
                        [t("createdAt"), stamp(detail.record.createdAt)],
                        [t("updatedAt"), stamp(detail.record.updatedAt)],
                        [t("messageCount"), detail.record.messageCount],
                        [
                          t("state"),
                          <Status key="status" status={detail.record.status} />,
                        ],
                      ].map(([label, value]) => (
                        <div
                          className="grid grid-cols-[78px_minmax(0,1fr)] gap-3"
                          key={String(label)}
                        >
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="min-w-0 break-words">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <Separator />
                    <section className="flex flex-col gap-3">
                      <h3 className="text-sm font-semibold">
                        {t("tokenDetails")}
                      </h3>
                      <TokenTotal record={detail.record} />
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        {["input", "output", "cacheRead", "cacheWrite"].map(
                          (key) => (
                            <div
                              className="flex flex-col gap-1 rounded-md bg-muted/40 p-2"
                              key={key}
                            >
                              <dt className="text-muted-foreground">
                                {t(`usage.${key}`)}
                              </dt>
                              <dd className="font-medium tabular-nums">
                                {detail.record.usage
                                  ? detail.record.usage[
                                      key as
                                        | "input"
                                        | "output"
                                        | "cacheRead"
                                        | "cacheWrite"
                                    ].toLocaleString("en-US")
                                  : t("unknown")}
                              </dd>
                            </div>
                          )
                        )}
                      </dl>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t("usageCoverage", {
                          count: detail.record.usageRecordedMessages,
                          runs: detail.record.unrecordedRuns,
                          total: detail.record.completedMessages,
                        })}
                      </p>
                    </section>
                    <Separator />
                    <h3 className="text-sm font-semibold">{t("preview")}</h3>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <Messages messages={detail.messages} preview />
                    </div>
                    <Button onClick={handleFull}>{t("fullRecord")}</Button>
                    <Button onClick={handleCopy} variant="outline">
                      <CopyIcon />
                      {t("copyId")}
                    </Button>
                  </>
                ) : (
                  <Spinner />
                )}
              </div>
            </aside>
          )}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t("notice")}</p>
        <Dialog onOpenChange={setFull} open={full}>
          <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>
                {detail?.record.title || t("fullRecord")}
              </DialogTitle>
              <DialogDescription>{t("readonly")}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto py-4">
              {fullError ? (
                <p role="alert">{t("loadError")}</p>
              ) : fullDetail ? (
                <Messages messages={fullDetail.messages} />
              ) : (
                <Spinner />
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button
                disabled={!fullDetail || fullDetail.page <= 1}
                onClick={handleMessagePrevious}
                variant="outline"
              >
                {t("previous")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("page", { page: fullDetail?.page || messagePage })}
              </span>
              <Button
                disabled={
                  !fullDetail || fullDetail.page * 50 >= fullDetail.total
                }
                onClick={handleMessageNext}
                variant="outline"
              >
                {t("next")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
