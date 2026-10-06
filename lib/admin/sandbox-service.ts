import type {
  SandboxInstanceListFilter,
  SandboxInstanceView,
} from "@/lib/db/sandbox-queries";
import type { SandboxInstanceRecord } from "@/lib/db/schema";
import type {
  SandboxControl,
  SandboxObservation,
  SandboxProviderName,
} from "@/lib/runtime/sandbox";

export type ManagedSandboxView = SandboxInstanceView & {
  observedAt: string | null;
  syncError: boolean;
  controllable: boolean;
};

export type SandboxAdminListPage = {
  items: ManagedSandboxView[];
  total: number;
  page: number;
  pageSize: number;
};

export class SandboxAdminError extends Error {
  readonly code: "notFound" | "unavailable" | "notRenewable";
  readonly status: number;
  constructor(code: SandboxAdminError["code"], status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

type Dependencies = {
  list: () => Promise<SandboxInstanceView[]>;
  listPage: (options: {
    filter: SandboxInstanceListFilter;
    page: number;
    pageSize: number;
    query: string;
  }) => Promise<{
    rows: SandboxInstanceView[];
    total: number;
    page: number;
  }>;
  get: (
    provider: SandboxProviderName,
    externalId: string
  ) => Promise<SandboxInstanceRecord | null>;
  observe: (
    provider: SandboxProviderName,
    externalId: string,
    observation: {
      status: SandboxInstanceView["status"];
      expiresAt?: Date | null;
    },
    renewed?: boolean
  ) => Promise<void>;
  control: (provider: SandboxProviderName) => SandboxControl | undefined;
  stopRun: (chatId: string, runId: string | null) => Promise<void>;
};

/** Admin orchestration. Providers own infrastructure; DB queries own persistence. */
export class SandboxAdminService {
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly deps: Dependencies;
  constructor(deps: Dependencies) {
    this.deps = deps;
  }

  private async exclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    this.pending.set(key, next);
    try {
      return await next;
    } finally {
      if (this.pending.get(key) === next) {
        this.pending.delete(key);
      }
    }
  }

  async list(): Promise<ManagedSandboxView[]> {
    return this.enrich(await this.deps.list());
  }

  async listPage(options: {
    filter: SandboxInstanceListFilter;
    page: number;
    pageSize: number;
    query: string;
  }): Promise<SandboxAdminListPage> {
    const { rows, page, total } = await this.deps.listPage(options);
    return {
      items: await this.enrich(rows),
      page,
      pageSize: options.pageSize,
      total,
    };
  }

  /** 逐实例核对真实容器状态；单页行数有限，观察请求按 4 个一批限流。 */
  private async enrich(
    rows: SandboxInstanceView[]
  ): Promise<ManagedSandboxView[]> {
    const result: ManagedSandboxView[] = [];
    // Bound provider requests, so a large registry does not flood the server.
    for (let offset = 0; offset < rows.length; offset += 4) {
      result.push(
        // biome-ignore lint/performance/noAwaitInLoops: bounded batches prevent flooding the lifecycle server
        ...(await Promise.all(
          rows.slice(offset, offset + 4).map((row) =>
            this.exclusive(`${row.provider}:${row.externalId}`, async () => {
              const current = await this.deps.get(row.provider, row.externalId);
              const item = { ...row, ...current };
              if (item.status === "destroyed") {
                return {
                  ...item,
                  controllable: false,
                  observedAt: null,
                  syncError: false,
                };
              }
              try {
                const control = this.deps.control(item.provider);
                if (!control) {
                  throw new Error("Provider control is unavailable");
                }
                const observation = await control.inspect(item.externalId);
                const state: {
                  status: SandboxInstanceView["status"];
                  expiresAt?: Date | null;
                } = observation ?? {
                  status:
                    item.expiresAt.getTime() <= Date.now()
                      ? ("expired" as const)
                      : ("destroyed" as const),
                };
                await this.deps.observe(item.provider, item.externalId, state);
                return {
                  ...item,
                  controllable:
                    state.status !== "destroyed" && state.status !== "expired",
                  expiresAt: state.expiresAt ?? item.expiresAt,
                  observedAt: new Date().toISOString(),
                  status: state.status,
                  syncError: false,
                };
              } catch {
                // An outage is not evidence of container destruction.
                return {
                  ...item,
                  controllable: false,
                  observedAt: null,
                  syncError: true,
                };
              }
            })
          )
        ))
      );
    }
    return result;
  }

  act(
    provider: SandboxProviderName,
    externalId: string,
    action: "destroy" | "renew"
  ) {
    return this.exclusive(`${provider}:${externalId}`, async () => {
      const row = await this.deps.get(provider, externalId);
      if (!row) {
        throw new SandboxAdminError("notFound", 404);
      }
      if (action === "destroy" && row.status === "destroyed") {
        return;
      }
      const control = this.deps.control(provider);
      if (!control) {
        throw new SandboxAdminError("unavailable", 503);
      }
      if (action === "destroy") {
        await this.deps.stopRun(row.chatId, row.lastRunId);
        await control.destroy(externalId);
        await this.deps.observe(provider, externalId, { status: "destroyed" });
        return;
      }
      if (row.status === "destroyed") {
        throw new SandboxAdminError("notRenewable", 409);
      }
      const live = await control.inspect(externalId);
      if (!live || !["ready", "paused"].includes(live.status)) {
        throw new SandboxAdminError("notRenewable", 409);
      }
      const observation: SandboxObservation = await control.extend(
        externalId,
        3600
      );
      // Docker only has a registry lease. OpenSandbox reports its native deadline.
      observation.expiresAt ??= new Date(
        Math.max(row.expiresAt.getTime(), Date.now()) + 3_600_000
      );
      await this.deps.observe(provider, externalId, observation, true);
    });
  }
}
