export type ChatModelCatalog = {
  defaultModelId: string | null;
  models: { id: string }[];
};

/** Resolve only against the member's current authorized catalog. */
export function resolveChatModelId(
  catalog: ChatModelCatalog | undefined,
  preferredId: string
): string | null {
  if (!catalog) {
    return null;
  }
  if (catalog.models.some((model) => model.id === preferredId)) {
    return preferredId;
  }
  if (catalog.models.some((model) => model.id === catalog.defaultModelId)) {
    return catalog.defaultModelId;
  }
  return catalog.models[0]?.id ?? null;
}
