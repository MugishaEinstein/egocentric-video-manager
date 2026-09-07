import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { hasActionableRejectionComment, isMinimum1080p } from "./validation";
import {
  createSubmission,
  createTask,
  getSubmissionById,
  getTaskById,
  listAllSubmissions,
  listAllTasks,
  listOperators,
  listSubmissionsForUser,
  listTasksForUser,
  reviewSubmission,
} from "./db";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const uploadInput = z.object({
  taskId: z.number().int().positive(),
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string().startsWith("video/"),
  contentBase64: z.string().min(100),
  fileSizeBytes: z.number().int().positive().max(MAX_VIDEO_BYTES),
  durationSeconds: z.number().int().nonnegative().optional(),
  width: z.number().int().min(1920),
  height: z.number().int().min(1080),
});

const adminOnly = adminProcedure;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: router({
    operatorSummary: protectedProcedure.query(async ({ ctx }) => {
      const [tasks, submissions] = await Promise.all([
        listTasksForUser(ctx.user.id),
        listSubmissionsForUser(ctx.user.id),
      ]);
      return { tasks, submissions };
    }),
    adminSummary: adminOnly.query(async () => {
      const [tasks, submissions, operators] = await Promise.all([
        listAllTasks(),
        listAllSubmissions(),
        listOperators(),
      ]);
      return { tasks, submissions, operators };
    }),
    createTask: adminOnly
      .input(z.object({ title: z.string().min(3).max(180), instructions: z.string().min(10), taskDate: z.coerce.date(), assignedTo: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const id = await createTask({ ...input, createdBy: ctx.user.id });
        return { id };
      }),
    uploadVideo: protectedProcedure.input(uploadInput).mutation(async ({ ctx, input }) => {
      if (!isMinimum1080p(input.width, input.height)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This recording is below the required 1080p minimum (1920×1080)." });
      }
      const task = await getTaskById(input.taskId, ctx.user.id);
      if (!task) throw new TRPCError({ code: "FORBIDDEN", message: "This task is not assigned to your account." });
      const buffer = Buffer.from(input.contentBase64, "base64");
      if (buffer.length !== input.fileSizeBytes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file size could not be verified." });
      }
      const safeName = input.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "-");
      const stored = await storagePut(`operators/${ctx.user.id}/submissions/${Date.now()}-${safeName}`, buffer, input.mimeType);
      const id = await createSubmission({
        operatorId: ctx.user.id,
        taskId: input.taskId,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        storageKey: stored.key,
        storageUrl: stored.url,
        fileSizeBytes: input.fileSizeBytes,
        durationSeconds: input.durationSeconds,
        width: input.width,
        height: input.height,
        status: "pending",
      });
      return { id };
    }),
    reviewSubmission: adminOnly
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]), reviewComment: z.string().trim().max(2000) }))
      .mutation(async ({ ctx, input }) => {
        if (input.status === "rejected" && !hasActionableRejectionComment(input.reviewComment)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Rejections require an actionable comment of at least 10 characters." });
        }
        const submission = await getSubmissionById(input.id);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found." });
        await reviewSubmission(input.id, ctx.user.id, input.status, input.reviewComment || null);
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
