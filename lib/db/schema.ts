import type { InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  foreignKey,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
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

export const skill = pgTable("Skill", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  description: varchar("description", { length: 1024 }).notNull(),
  displayName: text("displayName").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  name: varchar("name", { length: 64 }).primaryKey().notNull(),
  relativePath: text("relativePath").notNull(),
  source: varchar("source", { enum: ["catalog", "upload"] }).notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  uploadedBy: uuid("uploadedBy").references(() => user.id, {
    onDelete: "set null",
  }),
  version: varchar("version", { length: 64 }).notNull().default(""),
});

export type SkillRecord = InferSelectModel<typeof skill>;

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

export const stream = pgTable(
  "Stream",
  {
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
  },
  (table) => ({
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Stream = InferSelectModel<typeof stream>;
