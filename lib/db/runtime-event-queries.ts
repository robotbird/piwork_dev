import "server-only";

import { and, asc, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type {
  EventStore,
  PersistedRuntimeEvent,
} from "@/lib/runtime/run/event-store";
import { ChatbotError } from "../errors";
import { runtimeEvent } from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

async function wrapDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

/**
 * RuntimeEvent 表的 EventStore 实现（v2.0 §8.2）。
 * append 以 (runId, seq) 唯一索引做幂等；replay 供审计与 Step 8 跨进程恢复。
 */
export class PostgresEventStore implements EventStore {
  async append(event: PersistedRuntimeEvent): Promise<void> {
    await wrapDatabase(async () => {
      await db
        .insert(runtimeEvent)
        .values({
          data: event.data,
          runId: event.runId,
          seq: event.seq,
          type: event.type,
        })
        // (runId, seq) 冲突静默忽略——重复事件不重复落库
        .onConflictDoNothing({
          target: [runtimeEvent.runId, runtimeEvent.seq],
        });
    });
  }

  replay(runId: string, afterSeq: number): Promise<PersistedRuntimeEvent[]> {
    return wrapDatabase(async () => {
      const rows = await db
        .select()
        .from(runtimeEvent)
        .where(
          and(eq(runtimeEvent.runId, runId), gt(runtimeEvent.seq, afterSeq))
        )
        .orderBy(asc(runtimeEvent.seq));

      return rows.map((row) => ({
        createdAt: row.createdAt,
        data: row.data,
        runId: row.runId,
        seq: row.seq,
        type: row.type,
      }));
    });
  }

  latestSeq(runId: string): Promise<number> {
    return wrapDatabase(async () => {
      const [row] = await db
        .select({
          max: sql<number>`coalesce(max(${runtimeEvent.seq}), 0)`,
        })
        .from(runtimeEvent)
        .where(eq(runtimeEvent.runId, runId));

      return Number(row?.max ?? 0);
    });
  }
}
