import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { notifyUser } from "../websocket/handler";

export const groupRouter = Router();
groupRouter.use(authMiddleware);

// Create Group
groupRouter.post("/", async (req, res, next) => {
  try {
    const { name, members } = req.body;
    if (!name || !Array.isArray(members)) throw { status: 400, message: "Invalid group data" };
    
    const group = await db.group.create({
      data: {
        name,
        creatorId: req.user!.id,
        members: {
          create: [
            { userId: req.user!.id },
            ...members.map((id: string) => ({ userId: id }))
          ]
        }
      },
      include: { members: true }
    });
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// Get User's Groups
groupRouter.get("/", async (req, res, next) => {
  try {
    const groups = await db.group.findMany({
      where: {
        members: { some: { userId: req.user!.id } }
      },
      include: {
        members: { include: { user: { select: { username: true, displayName: true } } } }
      }
    });
    res.json(groups);
  } catch (err) {
    next(err);
  }
});
