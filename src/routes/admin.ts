import { Router } from "express";
import { authMiddleware, adminMiddleware } from "../middleware/auth";
import { AdminService } from "../services/adminService";

export const adminRouter = Router();

adminRouter.use(authMiddleware, adminMiddleware);

adminRouter.get("/stats", async (req, res, next) => {
  try {
    const stats = await AdminService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const users = await AdminService.listUsers(page);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/users/:id", async (req, res, next) => {
  try {
    await AdminService.deleteUser(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
