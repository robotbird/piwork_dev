import { getTranslations } from "next-intl/server";

import {
  deleteMcpServer,
  getMcpServer,
  getMcpServerByName,
  updateMcpServer,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const { id } = await params;
    const record = await getMcpServer(id);
    if (!record) {
      return errorResponse(new Error(t("mcpNotFound")), 404);
    }

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

    const update: Parameters<typeof updateMcpServer>[1] = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return errorResponse(new Error(t("mcpNameRequired")));
      }
      const name = body.name.trim();
      if (!NAME_PATTERN.test(name)) {
        return errorResponse(new Error(t("mcpInvalidName")));
      }
      if (name !== record.name && (await getMcpServerByName(name))) {
        return errorResponse(new Error(t("mcpDuplicateName")), 409);
      }
      update.name = name;
    }

    if (body.transport !== undefined) {
      if (body.transport !== "stdio" && body.transport !== "http") {
        return errorResponse(new Error(t("mcpTransportRequired")));
      }
      update.transport = body.transport;
    }

    const transport = update.transport ?? record.transport;

    if (body.command !== undefined) {
      if (transport === "stdio") {
        if (typeof body.command !== "string" || !body.command.trim()) {
          return errorResponse(new Error(t("mcpCommandRequired")));
        }
        update.command = body.command.trim();
      } else {
        update.command = null;
      }
    } else if (transport === "http" && update.transport) {
      update.command = null;
    }

    if (body.url !== undefined) {
      if (transport === "http") {
        if (typeof body.url !== "string" || !body.url.trim()) {
          return errorResponse(new Error(t("mcpUrlRequired")));
        }
        const url = body.url.trim();
        if (!/^https?:\/\//.test(url)) {
          return errorResponse(new Error(t("mcpUrlRequired")));
        }
        update.url = url;
      } else {
        update.url = null;
      }
    } else if (transport === "stdio" && update.transport) {
      update.url = null;
    }

    if (transport === "stdio" && (update.command ?? record.command) === null) {
      return errorResponse(new Error(t("mcpCommandRequired")));
    }
    if (transport === "http" && (update.url ?? record.url) === null) {
      return errorResponse(new Error(t("mcpUrlRequired")));
    }

    if (body.args !== undefined) {
      if (
        !Array.isArray(body.args) ||
        body.args.length > 64 ||
        body.args.some((arg) => typeof arg !== "string")
      ) {
        return errorResponse(new Error(t("mcpInvalidArgs")));
      }
      update.args = body.args;
    }
    if (body.env !== undefined) {
      const env = asRecord(body.env);
      if (env === null) {
        return errorResponse(new Error(t("mcpInvalidEnv")));
      }
      update.env = env;
    }
    if (body.headers !== undefined) {
      const headers = asRecord(body.headers);
      if (headers === null) {
        return errorResponse(new Error(t("mcpInvalidEnv")));
      }
      update.headers = headers;
    }
    if (body.description !== undefined) {
      if (
        typeof body.description !== "string" ||
        body.description.length > 1024
      ) {
        return errorResponse(new Error(t("mcpDescriptionTooLong")));
      }
      update.description = body.description.trim();
    }
    if (body.enabled !== undefined) {
      update.enabled = Boolean(body.enabled);
    }

    const updated = await updateMcpServer(id, update);
    if (!updated) {
      return errorResponse(new Error(t("mcpNotFound")), 404);
    }
    return Response.json(
      { updated: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("managementApi");
  const session = await requireManagementAdmin();
  if (!session) {
    return unauthorized();
  }
  try {
    const { id } = await params;
    if (!(await getMcpServer(id))) {
      return errorResponse(new Error(t("mcpNotFound")), 404);
    }
    await deleteMcpServer(id);
    return Response.json(
      { deleted: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error, 500);
  }
}
