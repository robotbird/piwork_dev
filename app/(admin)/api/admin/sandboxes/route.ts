import { getTranslations } from "next-intl/server";
import { ChatbotError } from "@/lib/errors";
import { requireAdminRole } from "@/lib/admin/access";
import { SandboxAdminError } from "@/lib/admin/sandbox-service";
import { getSandboxAdminService } from "@/lib/admin/sandboxes";

function unauthorized() {
  return new ChatbotError("unauthorized:chat").toResponse();
}

async function errorResponse(error: unknown, status = 400) {
  const t = await getTranslations("adminApi");
  return Response.json(
    {
      error:
        error instanceof SandboxAdminError
          ? t(`sandbox${error.code[0].toUpperCase()}${error.code.slice(1)}`)
          : status === 400 && error instanceof Error
            ? error.message
            : t("sandboxUnavailable"),
    },
    { status }
  );
}

const PROVIDERS = new Set(["test", "docker", "opensandbox"]);
const ACTIONS = new Set(["destroy", "renew"]);
const FILTERS = new Set(["all", "active", "error", "destroyed"]);
const PAGE_SIZES = new Set([10, 20, 50]);

/** 管理端沙箱实例列表；仅管理员可用（opensandbox-integration-spec.md §6 管理功能） */
export async function GET(request: Request) {
  const session = await requireAdminRole();
  if (!session) {
    return unauthorized();
  }
  try {
    const params = new URL(request.url).searchParams;
    const pageParam = Number(params.get("page"));
    const pageSizeParam = Number(params.get("pageSize"));
    const activeOnly = params.get("activeOnly") === "1";
    const statusParam = params.get("status") ?? "all";
    const result = await getSandboxAdminService().listPage({
      filter: activeOnly
        ? "active"
        : FILTERS.has(statusParam)
          ? (statusParam as "all" | "active" | "error" | "destroyed")
          : "all",
      page:
        Number.isInteger(pageParam) && pageParam >= 1
          ? Math.min(pageParam, 100_000)
          : 1,
      pageSize: PAGE_SIZES.has(pageSizeParam) ? pageSizeParam : 10,
      query: (params.get("query") ?? "").trim().slice(0, 200),
    });
    return Response.json(
      {
        instances: result.items,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error, 500);
  }
}

/** Authenticated lifecycle operations; persist only after provider success. */
export async function POST(request: Request) {
  const t = await getTranslations("adminApi");
  const session = await requireAdminRole();
  if (!session) {
    return unauthorized();
  }
  try {
    const body = (await request.json()) as {
      action?: unknown;
      externalId?: unknown;
      provider?: unknown;
    };
    if (typeof body.provider !== "string" || !PROVIDERS.has(body.provider)) {
      return errorResponse(new Error(t("sandboxInvalidProvider")));
    }
    if (typeof body.externalId !== "string" || !body.externalId.trim()) {
      return errorResponse(new Error(t("sandboxInvalidExternalId")));
    }
    if (typeof body.action !== "string" || !ACTIONS.has(body.action)) {
      return errorResponse(new Error(t("sandboxInvalidAction")));
    }

    await getSandboxAdminService().act(
      body.provider as "test" | "docker" | "opensandbox",
      body.externalId.trim(),
      body.action as "destroy" | "renew"
    );
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(
      error,
      error instanceof SandboxAdminError ? error.status : 503
    );
  }
}
