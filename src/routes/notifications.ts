import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { NotificationService } from "../services/notificationService";

export const notificationsRouter = Router();

notificationsRouter.use(authMiddleware);

notificationsRouter.post("/subscribe", async (req, res, next) => {
  try {
    await NotificationService.subscribe(req.user!.id, req.body.subscription);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/unsubscribe", async (req, res, next) => {
  try {
    if (req.body.endpoint) {
      await NotificationService.unsubscribe(req.body.endpoint);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
