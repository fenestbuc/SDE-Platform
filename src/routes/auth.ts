import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { authLimiter } from "../middleware/rateLimit";
import { AuthService } from "../services/authService";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8),
  publicKey: z.string(),
  encryptedPrivKey: z.string(),
  salt: z.string(),
  iv: z.string(),
});

authRouter.post("/register", authLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

authRouter.post("/login", authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { accessToken, refreshToken } = await AuthService.login(req.body);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) throw { status: 401, message: "No refresh token provided" };
    
    const { accessToken } = await AuthService.refresh(token);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) await AuthService.logout(token);
    res.clearCookie("refreshToken");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
