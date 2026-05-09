import WebSocket from "ws";
import jwt from "jsonwebtoken";
import { config } from "../config";

const onlineUsers = new Map<string, Set<WebSocket>>();

export function handleConnection(ws: WebSocket) {
  let userId: string | null = null;

  ws.on("message", (messageStr: string) => {
    try {
      const msg = JSON.parse(messageStr);
      if (msg.type === "auth" && msg.token) {
        const decoded = jwt.verify(msg.token, config.JWT_SECRET) as any;
        userId = decoded.id;
        
        if (!onlineUsers.has(userId!)) onlineUsers.set(userId!, new Set());
        onlineUsers.get(userId!)!.add(ws);
        
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
    if (userId && onlineUsers.has(userId)) {
      const userSockets = onlineUsers.get(userId)!;
      userSockets.delete(ws);
      if (userSockets.size === 0) onlineUsers.delete(userId);
    }
  });
}

export function notifyUser(userId: string, payload: any) {
  if (onlineUsers.has(userId)) {
    const sockets = onlineUsers.get(userId)!;
    const msg = JSON.stringify(payload);
    sockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}
