import WebSocket from "ws";
import * as jwt from "jsonwebtoken";
import { config } from "../config";
import Redis from "ioredis";

let pub: Redis | null = null;
let sub: Redis | null = null;

try {
  // Only connect if not building for Vercel static or missing URL
  if (config.REDIS_URL && config.REDIS_URL.includes("redis")) {
    pub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3, enableOfflineQueue: false });
    sub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3, enableOfflineQueue: false });
    
    sub.subscribe("sde_messages", (err) => {
      if (err) console.error("Redis sub error:", err);
    });

    sub.on("message", (channel, messageStr) => {
      if (channel === "sde_messages") {
        try {
          const { recipientId, payload } = JSON.parse(messageStr);
          if (localSockets.has(recipientId)) {
            const msg = JSON.stringify(payload);
            localSockets.get(recipientId)!.forEach((ws) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
              }
            });
          }
        } catch (e) {
          console.error("Failed to process redis message:", e);
        }
      }
    });
    
    sub.on("error", () => {});
    pub.on("error", () => {});
  }
} catch (e) {
  console.warn("Redis initialization failed, falling back to local-only sockets");
}

// In-memory set of sockets for this node instance only
const localSockets = new Map<string, Set<WebSocket>>();

export function handleConnection(ws: WebSocket) {
  let userId: string | null = null;

  ws.on("message", (messageStr: string) => {
    try {
      const msg = JSON.parse(messageStr);
      if (msg.type === "auth" && msg.token) {
        const decoded = jwt.verify(msg.token, config.JWT_SECRET) as any;
        userId = decoded.id;
        
        if (!localSockets.has(userId!)) localSockets.set(userId!, new Set());
        localSockets.get(userId!)!.add(ws);
        
        ws.send(JSON.stringify({ type: "auth_success" }));
      }
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message or token" }));
    }
  });

  ws.on("close", () => {
    if (userId && localSockets.has(userId)) {
      const userSockets = localSockets.get(userId)!;
      userSockets.delete(ws);
      if (userSockets.size === 0) localSockets.delete(userId);
    }
  });
}

export function isUserOnline(userId: string): boolean {
  return localSockets.has(userId); // Local only, real online status would need a Redis Set
}

export function notifyUser(userId: string, payload: any) {
  if (pub) {
    try {
      pub.publish("sde_messages", JSON.stringify({ recipientId: userId, payload }));
    } catch (e) {
      console.warn("Failed to publish to redis");
    }
  } else if (localSockets.has(userId)) {
    // Fallback if redis is down
    const sockets = localSockets.get(userId)!;
    const msg = JSON.stringify(payload);
    sockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}
