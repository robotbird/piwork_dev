export type TranslationParams = Record<string, number | string>;

export type LocaleDefinition = {
  label: string;
  messages: Record<string, string>;
};

export function interpolate(
  message: string,
  params?: TranslationParams
): string {
  if (!params) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in params ? String(params[key]) : placeholder
  );
}
