import { getTranslations } from "next-intl/server";

import {
  createMcpServer,
  getMcpServerByName,
  listMcpServers,
} from "@/lib/db/mcp-server-queries";
import { ChatbotError } from "@/lib/errors";
import { requireManagementAdmin } from "@/lib/management/access";

function unauthorized() {
  return new ChatbotError("unauthorized:chat").toResponse();
}

async function errorResponse(error: unknown, status = 400) {
  const t = await getTranslations("managementApi");
  return Response.json(
    { error: error instanceof Error ? error.message : t("operationFailed") },
    { status }
  );
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_ARGS = 64;
const MAX_ENV_KEYS = 64;

function asRecord(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      return null;
    }
    result[key] = entry;
  }
  return result;
}

/** 管理端 MCP 服务 CRUD；仅管理员可用。 */
export async function GET() {
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const servers = await listMcpServers();
    return Response.json(
      { servers },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const body = (await request.json()) as {
      args?: unknown;
      command?: unknown;
      description?: unknown;
      enabled?: unknown;
      env?: unknown;
      headers?: unknown;
      name?: unknown;
      transport?: unknown;
      url?: unknown;
    };

    if (typeof body.name !== "string" || !body.name.trim()) {
      return errorResponse(new Error(t("mcpNameRequired")));
    }
    const name = body.name.trim();
    if (!NAME_PATTERN.test(name)) {
      return errorResponse(new Error(t("mcpInvalidName")));
    }
    if (body.transport !== "stdio" && body.transport !== "http") {
      return errorResponse(new Error(t("mcpTransportRequired")));
    }
    const { transport } = body;

    let command: string | null = null;
    if (transport === "stdio") {
      if (typeof body.command !== "string" || !body.command.trim()) {
        return errorResponse(new Error(t("mcpCommandRequired")));
      }
      command = body.command.trim();
    }

    let url: string | null = null;
    if (transport === "http") {
      if (typeof body.url !== "string" || !body.url.trim()) {
        return errorResponse(new Error(t("mcpUrlRequired")));
      }
      url = body.url.trim();
      if (!/^https?:\/\//.test(url)) {
        return errorResponse(new Error(t("mcpUrlRequired")));
      }
    }

    if (
      body.args !== undefined &&
      (!Array.isArray(body.args) ||
        body.args.length > MAX_ARGS ||
        body.args.some((arg) => typeof arg !== "string"))
    ) {
      return errorResponse(new Error(t("mcpInvalidArgs")));
    }
    const env = body.env === undefined ? {} : asRecord(body.env);
    if (env === null || Object.keys(env).length > MAX_ENV_KEYS) {
      return errorResponse(new Error(t("mcpInvalidEnv")));
    }
    const headers = body.headers === undefined ? {} : asRecord(body.headers);
    if (headers === null || Object.keys(headers).length > MAX_ENV_KEYS) {
      return errorResponse(new Error(t("mcpInvalidEnv")));
    }

    if (
      body.description !== undefined &&
      (typeof body.description !== "string" || body.description.length > 1024)
    ) {
      return errorResponse(new Error(t("mcpDescriptionTooLong")));
    }

    if (await getMcpServerByName(name)) {
      return errorResponse(new Error(t("mcpDuplicateName")), 409);
    }

    const record = await createMcpServer({
      args: body.args ?? [],
      command,
      createdBy: session.userId,
      description:
        typeof body.description === "string" ? body.description.trim() : "",
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
      env,
      headers,
      name,
      transport,
      url,
    });
    return Response.json(
      { id: record.id },
      { headers: { "Cache-Control": "no-store" }, status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
