import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://localhost:5432/db"),
  PORT: z.string().default("3000"),
  NODE_ENV: z.string().default("development"),
  JWT_SECRET: z.string().default("dev-secret"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret"),
  UPLOAD_DIR: z.string().default("uploads"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

export const config = envSchema.parse(process.env);
