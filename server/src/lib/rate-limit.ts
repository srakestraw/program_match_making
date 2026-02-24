import type { Request, Response, NextFunction } from "express";
import { sendError } from "./http.js";

type RateLimitOptions = {
  max: number;
  windowMs: number;
  name: string;
};

type Entry = {
  count: number;
  resetAt: number;
};

export const createRateLimiter = ({ max, windowMs, name }: RateLimitOptions) => {
  const store = new Map<string, Entry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${name}:${ip}`;
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return sendError(res, 429, "Too many requests. Please retry shortly.");
    }

    current.count += 1;
    store.set(key, current);
    return next();
  };
};
