import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { config } from "./config";
import { globalLimiter } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/error";
import { setupWebSocket } from "./websocket/server";

import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/users";
import { messageRouter } from "./routes/messages";
import { adminRouter } from "./routes/admin";
import { notificationsRouter } from "./routes/notifications";
import { keyRouter } from "./routes/keys";
import { groupRouter } from "./routes/groups";

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "blob:"], // unsafe-inline needed for simple frontend without bundler
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:9000", config.S3_ENDPOINT || ""],
      workerSrc: ["'self'", "blob:"],
      imgSrc: ["'self'", "data:"],
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(globalLimiter);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/messages", messageRouter);
app.use("/api/admin", adminRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/keys", keyRouter);
app.use("/api/groups", groupRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date(), express: true });
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date(), api: true, express: true });
});

// Serve frontend
app.use(express.static(path.join(__dirname, "../src/client/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../src/client/dist/index.html"));
});

app.use(errorHandler);

// WS
setupWebSocket(server);

if (process.env.NODE_ENV !== 'production' || process.env.RUN_SERVER === 'true') {
  server.listen(config.PORT, () => {
    console.log(`SDE-Platform running on port ${config.PORT}`);
  });
}

export default app;
