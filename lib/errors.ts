import { CHAT_TEXT_PART_MAX_LENGTH } from "@/lib/chat-input";
import { DEFAULT_LANGUAGE } from "@/lib/i18n";
import { translateMessage } from "@/lib/i18n/messages";

export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "not_found"
  | "rate_limit"
  | "offline";

export type Surface =
  | "chat"
  | "model"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "vote"
  | "document"
  | "suggestions"
  | "activate_gateway";

export type ErrorCode = `${ErrorType}:${Surface}`;

export type ErrorVisibility = "response" | "log" | "none";

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  activate_gateway: "response",
  api: "response",
  auth: "response",
  chat: "response",
  database: "log",
  document: "response",
  history: "response",
  model: "response",
  stream: "response",
  suggestions: "response",
  vote: "response",
};

export class ChatbotError extends Error {
  type: ErrorType;
  surface: Surface;
  statusCode: number;

  constructor(errorCode: ErrorCode, cause?: string | ErrorOptions) {
    const message = getMessageByErrorCode(errorCode);
    const options = typeof cause === "string" ? undefined : cause;

    super(message, options);

    const [type, surface] = errorCode.split(":");

    this.type = type as ErrorType;
    if (typeof cause === "string") {
      this.cause = cause;
    }
    this.surface = surface as Surface;
    this.statusCode = getStatusCodeByType(this.type);
  }

  toResponse(locale: string = DEFAULT_LANGUAGE) {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { cause, statusCode } = this;
    const message = getMessageByErrorCode(code, locale);

    if (visibility === "log") {
      console.error({
        cause,
        code,
        message,
      });

      return Response.json(
        { code: "", message: translateMessage("errors.generic", {}, locale) },
        { status: statusCode }
      );
    }

    return Response.json({ cause, code, message }, { status: statusCode });
  }
}

export function getMessageByErrorCode(
  errorCode: ErrorCode,
  locale = "en"
): string {
  if (errorCode.includes("database")) {
    return translateMessage("errors.database", {}, locale);
  }

  switch (errorCode) {
    case "bad_request:api":
      return translateMessage("errors.badRequestApi", {}, locale);

    case "bad_request:activate_gateway":
      return translateMessage("errors.gateway", {}, locale);

    case "unauthorized:auth":
      return translateMessage("errors.signIn", {}, locale);
    case "forbidden:auth":
      return translateMessage("errors.forbiddenAuth", {}, locale);

    case "rate_limit:chat":
      return translateMessage("errors.messageLimit", {}, locale);
    case "conflict:chat":
      return translateMessage("errors.conflictChat", {}, locale);
    case "not_found:chat":
      return translateMessage("errors.chatNotFound", {}, locale);
    case "forbidden:model":
      return translateMessage("errors.forbiddenModel", {}, locale);
    case "forbidden:chat":
      return translateMessage("errors.forbiddenChat", {}, locale);
    case "unauthorized:chat":
      return translateMessage("errors.signInChat", {}, locale);
    case "bad_request:chat":
      return translateMessage(
        "errors.messageTooLong",
        { limit: CHAT_TEXT_PART_MAX_LENGTH.toLocaleString(locale) },
        locale
      );
    case "offline:chat":
      return translateMessage("errors.offlineChat", {}, locale);

    case "not_found:document":
      return translateMessage("errors.documentNotFound", {}, locale);
    case "forbidden:document":
      return translateMessage("errors.forbiddenDocument", {}, locale);
    case "unauthorized:document":
      return translateMessage("errors.signInDocument", {}, locale);
    case "bad_request:document":
      return translateMessage("errors.badRequestDocument", {}, locale);

    default:
      return translateMessage("errors.generic", {}, locale);
  }
}

function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "conflict":
      return 409;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "offline":
      return 503;
    default:
      return 500;
  }
}
