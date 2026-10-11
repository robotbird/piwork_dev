import { LocalizedError } from "@/lib/i18n/messages";

/** Safe user-facing processing limits, separate from parser/DB/internal errors. */
export class DocumentInputError extends LocalizedError {}
