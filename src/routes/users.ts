import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { UserService } from "../services/userService";

export const userRouter = Router();

userRouter.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const user = await UserService.getProfile(req.user!.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

userRouter.get("/search", authMiddleware, async (req, res, next) => {
  try {
    const q = req.query.q as string;
    const users = await UserService.searchUsers(q);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

userRouter.get("/:username", authMiddleware, async (req, res, next) => {
  try {
    const user = await UserService.getPublicProfile(req.params.username as string);
    res.json(user);
  } catch (err) {
    next(err);
  }
});
