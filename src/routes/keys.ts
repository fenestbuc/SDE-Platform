import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";

export const keyRouter = Router();
keyRouter.use(authMiddleware);

// Upload PreKeys
keyRouter.post("/prekeys", async (req, res, next) => {
  try {
    const { preKeys } = req.body;
    if (!Array.isArray(preKeys)) throw { status: 400, message: "preKeys must be an array" };
    
    await db.preKey.createMany({
      data: preKeys.map((pk: any) => ({
        userId: req.user!.id,
        keyId: pk.keyId,
        publicKey: pk.publicKey
      }))
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Fetch PreKey for a user
keyRouter.get("/bundle/:username", async (req, res, next) => {
  try {
    const user = await db.user.findUnique({
      where: { username: req.params.username },
      include: { preKeys: { take: 1 } }
    });
    
    if (!user) throw { status: 404, message: "User not found" };
    
    if (!user.preKeys || user.preKeys.length === 0) {
      return res.json({
        id: user.id,
        identityKey: user.publicKey,
        preKeyId: null,
        preKey: null
      });
    }
    
    const preKey = user.preKeys[0];
    await db.preKey.delete({ where: { id: preKey.id } });
    
    res.json({
      id: user.id,
      identityKey: user.publicKey,
      preKeyId: preKey.keyId,
      preKey: preKey.publicKey
    });
  } catch (err) {
    next(err);
  }
});

// Sync Session State
keyRouter.post("/session-state", async (req, res, next) => {
  try {
    const { stateBlob } = req.body;
    await db.sessionState.upsert({
      where: { userId: req.user!.id },
      update: { stateBlob },
      create: { userId: req.user!.id, stateBlob }
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

keyRouter.get("/session-state", async (req, res, next) => {
  try {
    const state = await db.sessionState.findUnique({ where: { userId: req.user!.id } });
    res.json({ stateBlob: state?.stateBlob || null });
  } catch (err) {
    next(err);
  }
});
