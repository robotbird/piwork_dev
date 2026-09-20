import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LANGUAGE, isAppLanguage, normalizeLanguage } from "@/lib/i18n";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const savedLanguage = cookieStore.get("NEXT_LOCALE")?.value ?? null;
  const acceptedLanguages = headerStore.get("accept-language") ?? "";
  const locale = isAppLanguage(savedLanguage)
    ? savedLanguage
    : (normalizeLanguage(savedLanguage ?? "") ??
      normalizeLanguage(acceptedLanguages) ??
      DEFAULT_LANGUAGE);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
