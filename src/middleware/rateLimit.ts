import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test:e2e';

export const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isTest ? 1000 : 100,
  message: { error: "Too many requests from this IP, please try again later." }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: { error: "Too many login attempts, please try again later." }
});
