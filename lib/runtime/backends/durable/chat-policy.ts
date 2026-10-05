import path from "node:path";

export type DurableChatConfig = {
  /** null: development allows all UUIDs; DB membership/ownership is still required. */
  users: ReadonlySet<string> | null;
  storageRoot: string;
  filesRoot: string;
  provider: "docker" | "opensandbox";
  image: string;
};
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

/** Development needs no user whitelist; test remains restricted. Never a client grant. */
export function readDurableChatConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): DurableChatConfig | null {
  if (env.PIWORK_DURABLE_CHAT_ENABLED !== "1") {
    return null;
  }
  if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
    throw new Error("runtime:durable-chat:non-production-only");
  }
  const users = (env.PIWORK_DURABLE_CHAT_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  const storageRoot = env.PIWORK_DURABLE_STORAGE_DIR ?? "";
  const filesRoot = env.UPLOAD_DIR ?? "";
  const provider = env.PIWORK_SANDBOX_PROVIDER;
  if (
    (env.NODE_ENV === "test" &&
      (!users.length || users.some((id) => !UUID.test(id)))) ||
    !path.isAbsolute(storageRoot) ||
    !path.isAbsolute(filesRoot) ||
    (provider !== "docker" && provider !== "opensandbox") ||
    env.PIWORK_RUNTIME_BACKEND === "durable" ||
    env.PIWORK_DISABLE_EXECUTION_TOOLS
  ) {
    throw new Error("runtime:durable-chat:invalid-config");
  }
  const storage = path.resolve(storageRoot);
  const files = path.resolve(filesRoot);
  const workspace = path.resolve(".pi/workspace");
  if (
    overlap(storage, files) ||
    overlap(storage, workspace) ||
    overlap(files, workspace)
  ) {
    throw new Error("runtime:durable-chat:private-roots-overlap");
  }
  return {
    filesRoot: files,
    image: env.PIWORK_SANDBOX_IMAGE ?? "pi-runtime:dev",
    provider,
    storageRoot: storage,
    users: env.NODE_ENV === "development" ? null : new Set(users),
  };
}
function overlap(a: string, b: string) {
  return (
    a === b ||
    a.startsWith(`${b}${path.sep}`) ||
    b.startsWith(`${a}${path.sep}`)
  );
}
/** Policy admission only: callers must also check enabled formal membership in DB. */
export function isDurableChatUserAllowed(
  config: DurableChatConfig | null,
  userId: string
): boolean {
  return Boolean(
    config &&
      UUID.test(userId) &&
      (config.users === null || config.users.has(userId.toLowerCase()))
  );
}
export function assertDurableChatUser(
  config: DurableChatConfig | null,
  userId: string
) {
  if (!isDurableChatUserAllowed(config, userId)) {
    throw new Error("runtime:durable-chat:not-authorized");
  }
}
