import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";
export async function taskApiError(error: unknown) {
  const t = await getTranslations("api");
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return Response.json({ error: t("taskInputInvalid") }, { status: 400 });
  }
  console.error("[scheduled-tasks]", error);
  return Response.json({ error: t("retryLater") }, { status: 500 });
}
