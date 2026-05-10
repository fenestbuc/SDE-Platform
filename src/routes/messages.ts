import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { MessageService } from "../services/messageService";
import { FileService } from "../services/fileService";
import * as fs from "fs/promises";
import * as path from "path";

import * as express from "express";

export const messageRouter = Router();

// Mock endpoints for E2E testing without S3
messageRouter.put("/mock-upload/:id", express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  await fs.mkdir("uploads", { recursive: true });
  await fs.writeFile(path.join("uploads", req.params.id), req.body);
  res.json({ success: true });
});

messageRouter.get("/mock-download/:id", async (req, res) => {
  try {
    const data = await fs.readFile(path.join("uploads", req.params.id));
    res.send(data);
  } catch (err) {
    res.status(404).send("Not found");
  }
});

messageRouter.use(authMiddleware);

messageRouter.post("/upload-url", async (req, res, next) => {
  try {
    const { filename, contentType } = req.body;
    const { url, fileId } = await FileService.getPresignedUploadUrl(filename, contentType);
    res.json({ url, fileId });
  } catch (err) {
    next(err);
  }
});

messageRouter.post("/", async (req, res, next) => {
  try {
    const message = await MessageService.sendMessage(req.user!.id, req.body);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

messageRouter.get("/inbox", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const messages = await MessageService.getInbox(req.user!.id, page);
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

messageRouter.get("/sent", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const messages = await MessageService.getSent(req.user!.id, page);
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

messageRouter.get("/:id", async (req, res, next) => {
  try {
    const message = await MessageService.getMessageById(req.user!.id, req.params.id);
    res.json(message);
  } catch (err) {
    next(err);
  }
});

messageRouter.get("/:id/attachment", async (req, res, next) => {
  try {
    const url = await MessageService.getAttachmentUrl(req.user!.id, req.params.id);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

messageRouter.post("/:id/read", async (req, res, next) => {
  try {
    await MessageService.markAsRead(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

messageRouter.delete("/:id", async (req, res, next) => {
  try {
    await MessageService.deleteMessage(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
