import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { dailyTasks, InsertUser, reviewHistory, users, videoSubmissions } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listOperators() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, "user")).orderBy(users.name);
}

export async function listTasksForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dailyTasks).where(eq(dailyTasks.assignedTo, userId)).orderBy(desc(dailyTasks.taskDate));
}

export async function listAllTasks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dailyTasks).orderBy(desc(dailyTasks.taskDate));
}

export async function listSubmissionsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videoSubmissions).where(eq(videoSubmissions.operatorId, userId)).orderBy(desc(videoSubmissions.submittedAt));
}

export async function listAllSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videoSubmissions).orderBy(desc(videoSubmissions.submittedAt));
}

export async function getTaskById(taskId: number, userId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const where = userId === undefined
    ? eq(dailyTasks.id, taskId)
    : and(eq(dailyTasks.id, taskId), eq(dailyTasks.assignedTo, userId));
  const result = await db.select().from(dailyTasks).where(where).limit(1);
  return result[0];
}

export async function getSubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(videoSubmissions).where(eq(videoSubmissions.id, id)).limit(1);
  return result[0];
}

export async function createTask(values: typeof dailyTasks.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(dailyTasks).values(values);
  return Number(result[0].insertId);
}

export async function createSubmission(values: typeof videoSubmissions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(videoSubmissions).values(values);
  return Number(result[0].insertId);
}

export async function reviewSubmission(id: number, reviewerId: number, status: "approved" | "rejected", reviewComment: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.transaction(async tx => {
    await tx.update(videoSubmissions).set({ status, reviewComment, reviewedBy: reviewerId, reviewedAt: new Date() }).where(eq(videoSubmissions.id, id));
    await tx.insert(reviewHistory).values({ submissionId: id, reviewerId, status, comment: reviewComment });
  });
}
