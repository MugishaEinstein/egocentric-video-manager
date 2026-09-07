import type { Express, Request, Response } from "express";
import Busboy from "busboy";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createContext } from "./_core/context";
import { getTaskById, createSubmission } from "./db";
import { storagePut } from "./storage";
import { isMinimum1080p } from "./validation";

function probe(path: string): Promise<{ width: number; height: number; durationSeconds?: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", path]);
    let output = "";
    let errors = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { errors += chunk; });
    child.on("close", code => {
      if (code !== 0) return reject(new Error(errors || "Unable to inspect video metadata"));
      try { const json = JSON.parse(output); const stream = json.streams?.[0]; const format = json.format; resolve({ width: Number(stream?.width), height: Number(stream?.height), durationSeconds: format?.duration ? Math.round(Number(format.duration)) : undefined }); } catch { reject(new Error("Unable to parse video metadata")); }
    });
  });
}

export function registerUploadRoute(app: Express) {
  app.post("/api/uploads/video", async (req: Request, res: Response) => {
    const context = await createContext({ req, res, info: {} as any });
    if (!context.user) return res.status(401).json({ message: "Sign in required" });
    const tempPath = join(tmpdir(), `fieldframe-${Date.now()}-${context.user.id}.video`);
    let taskId = ""; let originalFilename = "video"; let mimeType = "video/mp4"; let fileBytes = 0;
    try {
      await mkdir(tmpdir(), { recursive: true });
      await new Promise<void>((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers, limits: { fileSize: 500 * 1024 * 1024, files: 1 } });
        busboy.on("field", (name, value) => { if (name === "taskId") taskId = value; });
        busboy.on("file", (_name, file, info) => { originalFilename = info.filename || originalFilename; mimeType = info.mimeType || mimeType; const output = createWriteStream(tempPath); file.on("data", chunk => { fileBytes += chunk.length; }); file.on("limit", () => reject(new Error("Video exceeds the 500 MB limit"))); file.pipe(output); output.on("close", () => resolve()); output.on("error", reject); });
        busboy.on("error", reject); busboy.on("finish", () => resolve()); req.pipe(busboy);
      });
      const task = await getTaskById(Number(taskId), context.user.id);
      if (!task) return res.status(403).json({ message: "This task is not assigned to your account." });
      const metadata = await probe(tempPath);
      if (!isMinimum1080p(metadata.width, metadata.height)) return res.status(400).json({ message: "This recording is below the required 1080p minimum (1920×1080)." });
      const stored = await storagePut(`operators/${context.user.id}/submissions/${Date.now()}-${originalFilename.replace(/[^a-zA-Z0-9._-]/g, "-")}`, await readFile(tempPath), mimeType);
      const id = await createSubmission({ operatorId: context.user.id, taskId: Number(taskId), originalFilename, mimeType, storageKey: stored.key, storageUrl: stored.url, fileSizeBytes: fileBytes, durationSeconds: metadata.durationSeconds, width: metadata.width, height: metadata.height, status: "pending" });
      res.json({ id, width: metadata.width, height: metadata.height });
    } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : "Upload failed" }); } finally { await rm(tempPath, { force: true }).catch(() => undefined); }
  });
}
