import type { InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  foreignKey,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  email: varchar("email", { length: 64 }).notNull(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  name: text("name"),
  password: varchar("password", { length: 64 }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const department = pgTable("Department", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  /** 部门负责人（成员 id）；负责人被删除时置空 */
  leaderId: uuid("leaderId").references((): AnyPgColumn => member.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 128 }).notNull(),
  /** 上级部门；部门被删除时下级的上级置空（提升为顶级） */
  parentId: uuid("parentId").references((): AnyPgColumn => department.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type DepartmentRecord = InferSelectModel<typeof department>;

export const member = pgTable("Member", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  /** 所属部门；部门被删除时置空（变为未分配） */
  departmentId: uuid("departmentId").references(
    (): AnyPgColumn => department.id,
    { onDelete: "set null" }
  ),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  role: varchar("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  status: varchar("status", { enum: ["enabled", "disabled"] })
    .notNull()
    .default("enabled"),
  title: varchar("title", { length: 128 }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  /** 关联的登录账号；账号被删除时成员一并删除 */
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
});

export type MemberRecord = InferSelectModel<typeof member>;

export const role = pgTable("Role", {
  /** 稳定标识；仅系统角色有值（super_admin / admin / member / auditor），自定义角色为空 */
  code: varchar("code", { length: 64 }).unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  description: varchar("description", { length: 1024 }),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  /** 成员人数上限；null 表示不限（超级管理员固定为 1，由接口与种子数据共同保证） */
  memberLimit: integer("memberLimit"),
  name: varchar("name", { length: 128 }).notNull().unique(),
  type: varchar("type", { enum: ["system", "custom"] })
    .notNull()
    .default("custom"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type RoleRecord = InferSelectModel<typeof role>;

export const memberRole = pgTable(
  "MemberRole",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    /** 成员被删除时随之移除 */
    memberId: uuid("memberId")
      .notNull()
      .references((): AnyPgColumn => member.id, { onDelete: "cascade" }),
    /** 角色被删除时随之移除 */
    roleId: uuid("roleId")
      .notNull()
      .references((): AnyPgColumn => role.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.memberId, table.roleId] }),
  })
);

export type MemberRoleRecord = InferSelectModel<typeof memberRole>;

export const skill = pgTable("Skill", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  description: varchar("description", { length: 1024 }).notNull(),
  displayName: text("displayName").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  name: varchar("name", { length: 64 }).primaryKey().notNull(),
  relativePath: text("relativePath").notNull(),
  source: varchar("source", {
    enum: ["catalog", "pi-package", "upload"],
  }).notNull(),
  /** 来源 pi 包的 source 标识（如 "npm:foo@1.0.0"）；卸载联动依据 */
  sourcePackage: varchar("sourcePackage", { length: 256 }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  uploadedBy: uuid("uploadedBy").references(() => user.id, {
    onDelete: "set null",
  }),
  version: varchar("version", { length: 64 }).notNull().default(""),
});

export type SkillRecord = InferSelectModel<typeof skill>;

/**
 * 已安装的 TypeScript 模型供应商插件。
 * definition 只包含公开目录；凭据使用应用主密钥加密后保存。
 */
export const modelProviderPlugin = pgTable("ModelProviderPlugin", {
  buildHash: varchar("buildHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  createdBy: uuid("createdBy").references(() => user.id, {
    onDelete: "set null",
  }),
  credentialSummary: json("credentialSummary")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  credentialsConfigured: boolean("credentialsConfigured")
    .notNull()
    .default(false),
  defaultModelId: varchar("defaultModelId", { length: 256 }),
  definition: json("definition").$type<Record<string, unknown>>().notNull(),
  description: varchar("description", { length: 1024 }),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  enabledModels: json("enabledModels").$type<string[]>().notNull().default([]),
  encryptedCredentials: text("encryptedCredentials").notNull(),
  healthStatus: varchar("healthStatus", {
    enum: ["unknown", "healthy", "degraded", "failed"],
  })
    .notNull()
    .default("healthy"),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  packageId: varchar("packageId", { length: 128 }).notNull(),
  providerKey: varchar("providerKey", { length: 128 }).notNull().unique(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  version: varchar("version", { length: 64 }).notNull(),
});

export type ModelProviderPluginRecord = InferSelectModel<
  typeof modelProviderPlugin
>;

/**
 * 管理端配置的 MCP 服务；启用项会同步进聊天工作区 `.mcp.json`
 * （pi 官方 cwd 级 MCP 发现格式，pi.dev/docs/latest/packages）。
 */
export const mcpServer = pgTable("McpServer", {
  args: json("args").$type<string[]>().notNull().default([]),
  command: varchar("command", { length: 512 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  createdBy: uuid("createdBy").references(() => user.id, {
    onDelete: "set null",
  }),
  description: varchar("description", { length: 1024 }).notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  env: json("env").$type<Record<string, string>>().notNull().default({}),
  headers: json("headers")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  /** 兼作工作区 .mcp.json 的 server key */
  name: varchar("name", { length: 64 }).notNull().unique(),
  transport: varchar("transport", { enum: ["stdio", "http"] }).notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  url: varchar("url", { length: 1024 }),
});

export type McpServerRecord = InferSelectModel<typeof mcpServer>;

/** pi 包资源清点计数（extensions 仅清点待运行时，不执行） */
export type PiPackageResourceSummary = {
  extensions: number;
  prompts: number;
  skills: number;
  themes: number;
};

/**
 * 已安装的官方 pi 包（pi.dev/packages 画廊同源）。
 * 安装动作为服务端 DefaultPackageManager.installAndPersist（受管 agentDir）；
 * 包内 skills 提取进 Skill 表，extensions 仅计数待扩展运行时接入。
 */
export const piPackage = pgTable("PiPackage", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  createdBy: uuid("createdBy").references(() => user.id, {
    onDelete: "set null",
  }),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  installedPath: text("installedPath").notNull(),
  /** 提取进技能库的 skill 名单（跳过冲突项不计入） */
  installedSkills: json("installedSkills")
    .$type<string[]>()
    .notNull()
    .default([]),
  name: varchar("name", { length: 128 }).notNull(),
  resourceSummary: json("resourceSummary")
    .$type<PiPackageResourceSummary>()
    .notNull(),
  /** "npm:<name>[@<version>]" 或本地绝对路径（仅开发/测试） */
  source: varchar("source", { length: 256 }).notNull().unique(),
  /** 系统插件（pi-mcp-adapter）：默认安装、不可卸载 */
  system: boolean("system").notNull().default(false),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  version: varchar("version", { length: 64 }).notNull().default(""),
});

export type PiPackageRecord = InferSelectModel<typeof piPackage>;

export const chat = pgTable("Chat", {
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  attachments: json("attachments").notNull(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  parts: json("parts").notNull(),
  role: varchar("role").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    isUpvoted: boolean("isUpvoted").notNull(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    content: text("content"),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    createdAt: timestamp("createdAt").notNull(),
    description: text("description"),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    documentId: uuid("documentId").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    isResolved: boolean("isResolved").notNull().default(false),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

/**
 * 一次 Agent Runtime 执行尝试（v2.0 §8）：chat 级逻辑 runtime key 的执行实例。
 * 状态机 queued → starting → running ↔ waiting_user └→ settled | failed | aborted；
 * waiting_user 为 Step 3+ RPC 双向交互预留，当前不写入（工具审批等待由前端
 * tool part state 表达，服务端无事件源）。
 */
export const agentRun = pgTable(
  "AgentRun",
  {
    /** 执行后端：in_process（MVP）| sandbox_rpc（Step 3+） */
    backend: varchar("backend", {
      enum: ["in_process", "sandbox_rpc"],
    })
      .notNull()
      .default("in_process"),
    /** 聊天被删除时连同执行记录一并删除 */
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    endedAt: timestamp("endedAt"),
    errorMessage: text("errorMessage"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    startedAt: timestamp("startedAt"),
    status: varchar("status", {
      enum: [
        "queued",
        "starting",
        "running",
        "waiting_user",
        "settled",
        "failed",
        "aborted",
      ],
    })
      .notNull()
      .default("queued"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    /** 活跃 run 查询 + 终态时间线 */
    chatIdx: index("AgentRun_chatId_idx").on(table.chatId, table.createdAt),
  })
);

export type AgentRunRecord = InferSelectModel<typeof agentRun>;

/**
 * 关键 RuntimeEvent 持久化（v2.0 §8.2）：状态、工具、Artifact、错误等事件带
 * (runId, seq) 单调游标序，支撑 SSE 按 cursor 恢复与审计；message.delta 经
 * 进程内 SSE 直传不入库（message 完成时随消息落库）。data 为规范化事件负载
 * （去掉 runId 冗余后的形状）；唯一 (runId, seq) 是事件幂等的基石。
 */
export const runtimeEvent = pgTable(
  "RuntimeEvent",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    data: json("data").$type<Record<string, unknown>>().notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    /** run 被删除（含 chat 级联）时一并删除 */
    runId: uuid("runId")
      .notNull()
      .references(() => agentRun.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: varchar("type", { length: 64 }).notNull(),
  },
  (table) => ({
    runSeq: uniqueIndex("RuntimeEvent_runId_seq_key").on(
      table.runId,
      table.seq
    ),
  })
);

export type RuntimeEventRecord = InferSelectModel<typeof runtimeEvent>;

/**
 * RuntimeLease：run 的临时归属与心跳（v2.0 §8）。MVP 单进程：acquire 即写、
 * 周期心跳、终态 release；stale 由惰性检测收敛为 failed。Step 5 起演进为
 * chat 级 lease 复用（TTL 续期），本表结构不变。
 */
export const runtimeLease = pgTable("RuntimeLease", {
  acquiredAt: timestamp("acquiredAt").notNull().defaultNow(),
  heartbeatAt: timestamp("heartbeatAt").notNull().defaultNow(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  /** 与 AgentRun 一一对应；run 删除时一并删除 */
  runId: uuid("runId")
    .notNull()
    .references(() => agentRun.id, { onDelete: "cascade" })
    .unique(),
  /** 持有者标识：进程实例 id（MVP）；Step 8 起为 worker id */
  workerId: varchar("workerId", { length: 128 }).notNull(),
});

export type RuntimeLeaseRecord = InferSelectModel<typeof runtimeLease>;

/** User-owned catalog; bytes stay in the existing file store or Document versions. */
export const libraryItem = pgTable(
  "LibraryItem",
  {
    contentType: text("contentType"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    documentId: uuid("documentId"),
    id: uuid("id").primaryKey().defaultRandom(),
    kind: varchar("kind", { enum: ["folder", "file"] }).notNull(),
    name: text("name").notNull(),
    parentId: uuid("parentId").references((): AnyPgColumn => libraryItem.id),
    size: integer("size").notNull().default(0),
    source: varchar("source", { enum: ["upload", "ai", "manual"] }).notNull(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    url: text("url"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => [
    index("LibraryItem_user_parent_idx").on(table.userId, table.parentId),
    uniqueIndex("LibraryItem_user_url_idx").on(table.userId, table.url),
  ]
);
