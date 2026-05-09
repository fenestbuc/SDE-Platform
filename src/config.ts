import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.string().default("3000"),
  NODE_ENV: z.string().default("development"),
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  UPLOAD_DIR: z.string().default("uploads"),
});

export const config = envSchema.parse(process.env);
