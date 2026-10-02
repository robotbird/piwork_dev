"use client";

import {
  PackageIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import {
  type ChangeEvent,
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export type PiPackageResourceSummaryView = {
  extensions: number;
  prompts: number;
  skills: number;
  themes: number;
};

export type PiPackageView = {
  id: string;
  installedSkills: string[];
  name: string;
  resourceSummary: PiPackageResourceSummaryView;
  source: string;
  system: boolean;
  version: string;
};

export type PiCatalogItemView = {
  date: string;
  description: string;
  keywords: string[];
  links: { npm?: string; repository?: string };
  name: string;
  publisher: string;
  version: string;
};

const CATALOG_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

async function requestJson(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = (await response.json().catch(() => null)) as {
      detail?: string;
      error?: string;
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

function InstalledPackageRow({
  onUninstallRequest,
  packageItem,
}: {
  onUninstallRequest: (packageItem: PiPackageView) => void;
  packageItem: PiPackageView;
}) {
  const { t } = usePreferences();
  const { resourceSummary } = packageItem;
  const handleUninstall = useCallback(
    () => onUninstallRequest(packageItem),
    [onUninstallRequest, packageItem]
  );

  return (
    <li className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{packageItem.name}</span>
          {packageItem.version ? (
            <span className="font-mono text-[13px] text-muted-foreground">
              v{packageItem.version}
            </span>
          ) : null}
          {packageItem.system ? (
            <Badge variant="secondary">
              <ShieldCheckIcon data-icon="inline-start" />
              {t("piPackages.badgeSystem")}
            </Badge>
          ) : null}
          <Badge variant="outline">
            {t("piPackages.badgeSkillsCount", {
              count: packageItem.installedSkills.length,
            })}
          </Badge>
          {resourceSummary.extensions > 0 ? (
            <Badge className="text-muted-foreground" variant="outline">
              {t("piPackages.badgeExtensionsPending", {
                count: resourceSummary.extensions,
              })}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 truncate font-mono text-[12px] text-muted-foreground">
          {packageItem.source}
        </p>
        {packageItem.system ? (
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("piPackages.systemNote")}
          </p>
        ) : null}
        {packageItem.installedSkills.length > 0 ? (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {t("piPackages.skillsLabel")}:{" "}
            <span className="font-mono">
              {packageItem.installedSkills.join(", ")}
            </span>
          </p>
        ) : null}
      </div>
      <div className="shrink-0 sm:pl-4">
        {packageItem.system ? null : (
          <Button onClick={handleUninstall} variant="ghost">
            <Trash2Icon data-icon="inline-start" />
            {t("piPackages.uninstall")}
          </Button>
        )}
      </div>
    </li>
  );
}

function CatalogCard({
  installed,
  onInstallRequest,
  item,
}: {
  installed: boolean;
  item: PiCatalogItemView;
  onInstallRequest: (item: PiCatalogItemView) => void;
}) {
  const { t } = usePreferences();
  const handleInstall = useCallback(
    () => onInstallRequest(item),
    [item, onInstallRequest]
  );

  return (
    <div className="flex flex-col rounded-[14px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {item.version ? `v${item.version}` : ""}
            {item.publisher ? ` · ${item.publisher}` : ""}
          </p>
        </div>
        <Button
          disabled={installed}
          onClick={handleInstall}
          size="sm"
          variant={installed ? "outline" : "default"}
        >
          {installed ? t("piPackages.installedLabel") : t("piPackages.install")}
        </Button>
      </div>
      <p className="mt-2 line-clamp-3 min-h-10 text-[13px] text-muted-foreground">
        {item.description}
      </p>
    </div>
  );
}

export function PiPackagesPage({
  initialPackages,
}: {
  initialPackages: PiPackageView[];
}) {
  const { t } = usePreferences();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const endpoint = `${basePath}/api/management/pi-packages`;
  const catalogEndpoint = `${endpoint}/catalog`;

  const [packages, setPackages] = useState(initialPackages);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PiCatalogItemView[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [customSource, setCustomSource] = useState("");
  const [installTarget, setInstallTarget] = useState<{
    name: string;
    source: string;
  } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<PiPackageView | null>(
    null
  );
  const [uninstalling, setUninstalling] = useState(false);

  const installedNames = useMemo(
    () => new Set(packages.map((packageItem) => packageItem.name)),
    [packages]
  );

  const refresh = useCallback(async () => {
    const result = await requestJson(endpoint);
    if ("error" in result && result.error) {
      toast.error(t(result.error));
      return;
    }
    const data = result.data as {
      packages?: PiPackageView[];
    } | null;
    setPackages(data?.packages ?? []);
  }, [endpoint, t]);

  const loadCatalog = useCallback(
    async (searchQuery: string, nextOffset: number, replace: boolean) => {
      if (replace) {
        setCatalogLoading(true);
      }
      setCatalogError(null);
      const result = await requestJson(
        `${catalogEndpoint}?q=${encodeURIComponent(searchQuery)}&offset=${nextOffset}`
      );
      if ("error" in result && result.error) {
        setCatalogError(result.error);
      } else {
        const data = result.data as {
          items?: PiCatalogItemView[];
          total?: number;
        } | null;
        setItems((current) =>
          replace ? (data?.items ?? []) : [...current, ...(data?.items ?? [])]
        );
        setTotal(data?.total ?? 0);
        setOffset(nextOffset);
      }
      setCatalogLoading(false);
    },
    [catalogEndpoint]
  );

  // 防抖搜索:输入停顿 300ms 后重查目录首页
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalog(query, 0, true).catch(() => undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loadCatalog, query]);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setQuery(event.currentTarget.value),
    []
  );

  const handleRetryCatalog = useCallback(() => {
    loadCatalog(query, 0, true).catch(() => undefined);
  }, [loadCatalog, query]);

  const handleLoadMore = useCallback(() => {
    loadCatalog(query, offset + CATALOG_PAGE_SIZE, false).catch(
      () => undefined
    );
  }, [loadCatalog, offset, query]);

  const handleInstallSource = useCallback((source: string, name: string) => {
    setInstallTarget({ name, source });
  }, []);

  const handleCustomSourceChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setCustomSource(event.currentTarget.value),
    []
  );

  const handleCustomSourceSubmit = useCallback(() => {
    const source = customSource.trim();
    if (!source) {
      toast.error(t("piPackages.sourceRequired"));
      return;
    }
    const name = source.startsWith("npm:")
      ? source.slice("npm:".length)
      : source;
    handleInstallSource(source, name);
  }, [customSource, handleInstallSource, t]);

  // 目录卡安装:钉住卡片展示的版本,避免安装到更新的版本
  const handleCatalogInstall = useCallback(
    (item: PiCatalogItemView) => {
      handleInstallSource(
        item.version ? `npm:${item.name}@${item.version}` : `npm:${item.name}`,
        item.name
      );
    },
    [handleInstallSource]
  );

  const handleConfirmInstall = useCallback(async () => {
    if (!installTarget) {
      return;
    }
    setInstalling(true);
    const result = await requestJson(endpoint, {
      body: JSON.stringify({ source: installTarget.source }),
      method: "POST",
    });
    if ("error" in result && result.error) {
      toast.error(t(result.error));
    } else {
      const data = result.data as {
        installedSkills?: string[];
        name?: string;
        skippedSkills?: Array<{ name: string }>;
      } | null;
      toast.success(
        t("piPackages.installSuccess", {
          count: data?.installedSkills?.length ?? 0,
          name: data?.name ?? installTarget.name,
        })
      );
      if ((data?.skippedSkills?.length ?? 0) > 0) {
        toast.info(
          t("piPackages.installSkipped", {
            count: data?.skippedSkills?.length ?? 0,
          })
        );
      }
      setInstallTarget(null);
      setCustomSource("");
      await refresh();
    }
    setInstalling(false);
  }, [endpoint, installTarget, refresh, t]);

  const handleCancelInstall = useCallback(() => setInstallTarget(null), []);

  const handleInstallDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !installing) {
        setInstallTarget(null);
      }
    },
    [installing]
  );

  const handleUninstallRequest = useCallback(
    (packageItem: PiPackageView) => setUninstallTarget(packageItem),
    []
  );

  const handleConfirmUninstall = useCallback(async () => {
    if (!uninstallTarget) {
      return;
    }
    setUninstalling(true);
    const result = await requestJson(endpoint, {
      body: JSON.stringify({ source: uninstallTarget.source }),
      method: "DELETE",
    });
    if ("error" in result && result.error) {
      toast.error(t(result.error));
    } else {
      const data = result.data as { removedSkills?: string[] } | null;
      toast.success(
        t("piPackages.uninstallSuccess", {
          name: uninstallTarget.name,
          skills: data?.removedSkills?.length ?? 0,
        })
      );
      setUninstallTarget(null);
      await refresh();
    }
    setUninstalling(false);
  }, [endpoint, refresh, t, uninstallTarget]);

  const handleUninstallDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !uninstalling) {
        setUninstallTarget(null);
      }
    },
    [uninstalling]
  );

  const handleConfirmInstallClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      handleConfirmInstall();
    },
    [handleConfirmInstall]
  );

  const handleConfirmUninstallClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      handleConfirmUninstall();
    },
    [handleConfirmUninstall]
  );

  return (
    <section className="min-w-0 px-5 py-8 sm:px-8 md:px-10 md:py-14 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-[960px]">
        <header>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">
            {t("management.piPluginsTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("management.piPluginsDescription")}
          </p>
        </header>

        <div className="mt-6 overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">
              {t("piPackages.installedTitle")}
            </h2>
          </div>
          {packages.length > 0 ? (
            <ul>
              {packages.map((packageItem) => (
                <InstalledPackageRow
                  key={packageItem.id}
                  onUninstallRequest={handleUninstallRequest}
                  packageItem={packageItem}
                />
              ))}
            </ul>
          ) : (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
                <PackageIcon className="size-5" />
              </span>
              <p className="mt-4 text-sm font-medium">
                {t("piPackages.installedEmptyTitle")}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {t("piPackages.installedEmptyDescription")}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium">
            {t("piPackages.discoverTitle")}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("piPackages.discoverDescription")}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label={t("piPackages.searchPlaceholder")}
                className="pl-9"
                onChange={handleQueryChange}
                placeholder={t("piPackages.searchPlaceholder")}
                type="search"
                value={query}
              />
            </div>
            <Input
              aria-label={t("piPackages.installSourcePlaceholder")}
              className="sm:w-72"
              onChange={handleCustomSourceChange}
              placeholder={t("piPackages.installSourcePlaceholder")}
              value={customSource}
            />
            <Button onClick={handleCustomSourceSubmit} variant="outline">
              {t("piPackages.installFromSource")}
            </Button>
          </div>

          {catalogError ? (
            <div className="mt-4 flex flex-col gap-3 rounded-[14px] border border-border bg-card px-5 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <p className="text-sm text-muted-foreground">{t(catalogError)}</p>
              <Button onClick={handleRetryCatalog} variant="outline">
                <RefreshCwIcon data-icon="inline-start" />
                {t("piPackages.retryCatalog")}
              </Button>
            </div>
          ) : catalogLoading ? (
            <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
              <Spinner />
              {t("piPackages.catalogLoading")}
            </div>
          ) : items.length > 0 ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <CatalogCard
                    installed={installedNames.has(item.name)}
                    item={item}
                    key={item.name}
                    onInstallRequest={handleCatalogInstall}
                  />
                ))}
              </div>
              {offset + CATALOG_PAGE_SIZE < total ? (
                <div className="mt-4 flex justify-center">
                  <Button onClick={handleLoadMore} variant="outline">
                    {t("piPackages.loadMore")}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4 rounded-[14px] border border-border bg-card px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {t("piPackages.noResults")}
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog
        onOpenChange={handleInstallDialogOpenChange}
        open={Boolean(installTarget)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("piPackages.installDialogTitle", {
                name: installTarget?.name ?? "",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("piPackages.installDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-[10px] bg-muted/50 px-3 py-2.5 font-mono text-[13px] text-muted-foreground">
            {installTarget?.source}
          </p>
          <DialogFooter>
            <Button
              disabled={installing}
              onClick={handleCancelInstall}
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={installing} onClick={handleConfirmInstallClick}>
              {installing ? <Spinner /> : null}
              {installing
                ? t("piPackages.installing")
                : t("piPackages.installConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={handleUninstallDialogOpenChange}
        open={Boolean(uninstallTarget)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("piPackages.uninstallDialogTitle", {
                name: uninstallTarget?.name ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("piPackages.uninstallDialogDescription", {
                count: uninstallTarget?.installedSkills.length ?? 0,
                name: uninstallTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uninstalling}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={uninstalling}
              onClick={handleConfirmUninstallClick}
            >
              {uninstalling ? <Spinner /> : null}
              {uninstalling
                ? t("piPackages.uninstalling")
                : t("piPackages.uninstall")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
