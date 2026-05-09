import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/auth";
import { MessageService } from "../services/messageService";

export const messageRouter = Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

messageRouter.use(authMiddleware);

messageRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const message = await MessageService.sendMessage(req.user!.id, req.body, req.file);
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
    const { buffer, attachment } = await MessageService.getAttachmentData(req.user!.id, req.params.id);
    res.setHeader("Content-Type", attachment.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${attachment.filename}"`);
    res.send(buffer);
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
