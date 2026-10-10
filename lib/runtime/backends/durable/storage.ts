import "server-only";

import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { Storage } from "@earendil-works/pi-durable";
import { SqliteStorage } from "@earendil-works/pi-durable/storage/sqlite";
import { openNodeSqliteDatabase } from "@earendil-works/pi-durable/storage/sqlite/node";

export type DurableStorageBinding = {
  userId: string;
  chatId: string;
  runId: string;
  /** Hash of immutable job inputs AND approved harness/tool configuration. */
  inputHash: string;
};
export type OwnedDurableStorage = {
  storage: Storage;
  close: () => Promise<void>;
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Single-writer local volume seam. No stale-lock stealing or automatic resume.
 * A crash leaves ownership blocked until the Worker/reaper proves old effects stopped.
 * Callers must authorize the binding before open and again before resume/execute.
 */
export async function openOwnedDurableStorage(
  root: string,
  binding: DurableStorageBinding
): Promise<OwnedDurableStorage> {
  if (
    !path.isAbsolute(root) ||
    ![binding.userId, binding.chatId, binding.runId].every((id) =>
      UUID.test(id)
    ) ||
    !/^[a-f0-9]{64}$/.test(binding.inputHash)
  ) {
    throw new Error("runtime:durable:invalid-storage-binding");
  }
  const directory = path.join(root, binding.runId);
  await mkdir(root, { mode: 0o700, recursive: true });
  await assertDirectory(root);
  await mkdir(directory, { mode: 0o700, recursive: true });
  await assertDirectory(directory);
  const lockPath = path.join(directory, "owner.lock");
  const lock = await open(
    lockPath,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_WRONLY |
      constants.O_NOFOLLOW,
    0o600
  ).catch((cause) => {
    throw new Error("runtime:durable:storage-owned-or-needs-review", { cause });
  });
  let storage: Storage | undefined;
  try {
    await lock.writeFile(
      JSON.stringify({ pid: process.pid, token: crypto.randomUUID() })
    );
    await lock.sync();
    await lock.close(); // Ownership is the exclusive marker, not an open fd.
    const manifestPath = path.join(directory, "binding.json");
    const manifest = JSON.stringify({
      schemaVersion: 1,
      ...binding,
      durableVersion: "1.1.0",
      piVersion: "1.1.0",
    });
    try {
      const file = await open(
        manifestPath,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          constants.O_NOFOLLOW,
        0o600
      );
      try {
        await file.writeFile(manifest);
        await file.sync();
      } finally {
        await file.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      await assertFile(manifestPath, 4096);
      if ((await readFile(manifestPath, "utf8")) !== manifest) {
        throw new Error("runtime:durable:storage-binding-mismatch", {
          cause: error,
        });
      }
    }
    const databasePath = path.join(directory, "session.sqlite");
    try {
      const file = await open(
        databasePath,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          constants.O_NOFOLLOW,
        0o600
      );
      await file.close();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      await assertFile(databasePath);
    }
    const database = await openNodeSqliteDatabase(databasePath);
    try {
      // Official facade; stronger than the installed adapter's NORMAL default.
      database.exec("PRAGMA synchronous = FULL");
      storage = await SqliteStorage.open(database);
    } catch (error) {
      database.close();
      throw error;
    }
    const owned = storage;
    let closing: Promise<void> | undefined;
    return {
      close: () => {
        closing ??= (async () => {
          // Never release ownership if storage shutdown is unconfirmed.
          await owned.close(BACKGROUND_CONTEXT);
          await unlink(lockPath);
        })();
        closing.catch(() => undefined);
        return closing;
      },
      storage: owned,
    };
  } catch (error) {
    try {
      await storage?.close(BACKGROUND_CONTEXT);
      await lock.close();
      await unlink(lockPath);
    } catch (cleanup) {
      // biome-ignore lint/style/useErrorCause: both original and cleanup causes are preserved in AggregateError
      throw new AggregateError(
        [error, cleanup],
        "runtime:durable:open-cleanup-failed",
        { cause: error }
      );
    }
    throw error;
  }
}

async function assertDirectory(target: string) {
  const stat = await lstat(target);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0
  ) {
    throw new Error("runtime:durable:insecure-storage-directory");
  }
}
async function assertFile(target: string, maximum = Number.MAX_SAFE_INTEGER) {
  const stat = await lstat(target);
  if (
    !stat.isFile() ||
    stat.nlink !== 1 ||
    stat.size > maximum ||
    (stat.mode & 0o077) !== 0
  ) {
    throw new Error("runtime:durable:insecure-storage-file");
  }
}
