import { Server } from "http";
import { WebSocketServer } from "ws";
import { handleConnection } from "./handler";

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    handleConnection(ws);
  });

  return wss;
}
