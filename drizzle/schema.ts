import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const dailyTasks = mysqlTable("daily_tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  instructions: text("instructions").notNull(),
  taskDate: timestamp("taskDate").notNull(),
  assignedTo: int("assignedTo").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reviewHistory = mysqlTable("review_history", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  reviewerId: int("reviewerId").notNull(),
  status: mysqlEnum("status", ["approved", "rejected"]).notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const videoSubmissions = mysqlTable("video_submissions", {
  id: int("id").autoincrement().primaryKey(),
  operatorId: int("operatorId").notNull(),
  taskId: int("taskId").notNull(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 700 }).notNull(),
  fileSizeBytes: int("fileSizeBytes").notNull(),
  durationSeconds: int("durationSeconds"),
  width: int("width").notNull(),
  height: int("height").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewComment: text("reviewComment"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type DailyTask = typeof dailyTasks.$inferSelect;
export type VideoSubmission = typeof videoSubmissions.$inferSelect;
export type ReviewHistory = typeof reviewHistory.$inferSelect;
