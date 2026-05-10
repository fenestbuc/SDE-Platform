import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { config } from "../config";
import { db } from "../db";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; email: string; role: string };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    req.user = { id: decoded.id, username: decoded.username, email: decoded.email, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
}
