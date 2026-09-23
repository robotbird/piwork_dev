import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const PAYLOAD_VERSION = "v1";

function credentialKey(): Buffer {
  const secret =
    process.env.PIWORK_PLUGIN_CREDENTIAL_KEY ?? process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "Set PIWORK_PLUGIN_CREDENTIAL_KEY or AUTH_SECRET (at least 16 characters) before installing model plugins"
    );
  }
  return createHash("sha256")
    .update(`piwork:model-provider-plugin:${secret}`)
    .digest();
}

export function encryptPluginCredentials(
  credentials: Record<string, unknown>
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  return [
    PAYLOAD_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptPluginCredentials(
  payload: string
): Record<string, unknown> {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (version !== PAYLOAD_VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported plugin credential payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    credentialKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const json = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

export function summarizeCredentials(
  credentials: Record<string, unknown>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(credentials).map(([key, value]) => {
      const text = typeof value === "string" ? value.trim() : "";
      if (!text) {
        return [key, ""];
      }
      if (key.toLowerCase().includes("key") || key.includes("secret")) {
        return [
          key,
          text.length > 7
            ? `${text.slice(0, 3)}••••${text.slice(-4)}`
            : "••••••••",
        ];
      }
      return [key, text];
    })
  );
}
