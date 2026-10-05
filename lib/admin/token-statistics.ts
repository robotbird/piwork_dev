import { z } from "zod";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const parsed = new Date(`${v}T00:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === v
    );
  });
export function defaultTokenDates(now = new Date()) {
  return {
    end: now.toISOString().slice(0, 10),
    start: new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10),
  };
}
export const tokenFilters = z
  .object({
    department: z
      .union([z.literal("all"), z.literal("none"), z.uuid()])
      .default("all"),
    end: date,
    start: date,
  })
  .refine(
    (v) =>
      v.start <= v.end &&
      (Date.parse(v.end) - Date.parse(v.start)) / 86_400_000 < 93,
    { message: "Select an ordered range of at most 93 days" }
  );
export type TokenFilters = z.infer<typeof tokenFilters>;
export type TokenRow = {
  day: string;
  userId: string;
  chatId: string;
  departmentId: string;
  department: string;
  role: string;
  model: string;
  tokens: number | null;
  completed: number;
  recorded: number;
};
export type TokenGroup = {
  id: string;
  key: string;
  tokens: number | null;
  users: number;
  conversations: number;
  change: number | null;
};
export function tokenChange(current: number | null, previous: number | null) {
  return current === null || previous === null || previous === 0
    ? null
    : ((current - previous) / previous) * 100;
}
function summarize(rows: TokenRow[]) {
  const recorded = rows.reduce((n, r) => n + r.recorded, 0);
  const users = new Set(rows.map((r) => r.userId)).size;
  const tokens = recorded
    ? rows.reduce((n, r) => n + (r.tokens ?? 0), 0)
    : null;
  return {
    average: tokens === null || users === 0 ? null : tokens / users,
    completed: rows.reduce((n, r) => n + r.completed, 0),
    conversations: new Set(rows.map((r) => r.chatId)).size,
    recorded,
    tokens,
    users,
  };
}
export function buildTokenStatistics(rows: TokenRow[], filters: TokenFilters) {
  const current = rows.filter(
    (r) => r.day >= filters.start && r.day <= filters.end
  );
  const previous = rows.filter((r) => r.day < filters.start);
  const summary = summarize(current);
  const prior = summarize(previous);
  const groups = (field: "department" | "role" | "model"): TokenGroup[] => {
    const identity = (row: TokenRow) =>
      field === "department" ? row.departmentId : row[field];
    const keys = [...new Set(current.map(identity))];
    return keys
      .map((id) => {
        const matching = current.filter((r) => identity(r) === id);
        const key = matching[0][field];
        const value = summarize(matching);
        return {
          change: tokenChange(
            value.tokens,
            summarize(previous.filter((r) => identity(r) === id)).tokens
          ),
          conversations: value.conversations,
          id,
          key,
          tokens: value.tokens,
          users: value.users,
        };
      })
      .sort(
        (a, b) =>
          (b.tokens ?? -1) - (a.tokens ?? -1) || a.key.localeCompare(b.key)
      );
  };
  const models = groups("model");
  const trend: { day: string; values: (number | null)[] }[] = [];
  for (
    let day = Date.parse(filters.start);
    day <= Date.parse(filters.end);
    day += 86_400_000
  ) {
    const label = new Date(day).toISOString().slice(0, 10);
    trend.push({
      day: label,
      values: models.map(
        (m) =>
          summarize(current.filter((r) => r.day === label && r.model === m.key))
            .tokens
      ),
    });
  }
  return {
    changes: {
      average: tokenChange(summary.average, prior.average),
      conversations: tokenChange(summary.conversations, prior.conversations),
      tokens: tokenChange(summary.tokens, prior.tokens),
      users: tokenChange(summary.users, prior.users),
    },
    departments: groups("department"),
    filters,
    models,
    roles: groups("role"),
    summary,
    trend,
  };
}
export type TokenStatistics = ReturnType<typeof buildTokenStatistics> & {
  departmentOptions: { id: string; name: string }[];
};
