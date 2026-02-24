import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { sessionsRouter } from "./routes/sessions.js";
import { realtimeRouter } from "./routes/realtime.js";
import { adminRouter } from "./routes/admin.js";
import { publicRouter } from "./routes/public.js";
import { advisorRouter } from "./routes/advisor.js";
import { phoneRouter } from "./phone/index.js";
import { smsRouter } from "./sms/index.js";
import { log } from "./lib/logger.js";
import { sendError } from "./lib/http.js";

const defaultOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

const parseOrigins = () => {
  const envOrigins = process.env.WIDGET_ALLOWED_ORIGINS;
  if (!envOrigins) return defaultOrigins;
  return envOrigins
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const createApp = () => {
  const app = express();
  const allowedOrigins = parseOrigins();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin not allowed by CORS"));
      }
    })
  );
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "100kb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") || randomUUID();
    res.setHeader("x-request-id", requestId);

    const start = Date.now();

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (
        body &&
        typeof body === "object" &&
        "error" in (body as Record<string, unknown>) &&
        typeof (body as Record<string, unknown>).error === "string"
      ) {
        return originalJson({
          error: {
            code: res.statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
            message: (body as Record<string, unknown>).error
          }
        });
      }

      return originalJson(body);
    }) as typeof res.json;

    res.on("finish", () => {
      log("info", "http.request", {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start
      });
    });

    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/sessions", sessionsRouter);
  app.use("/api/realtime", realtimeRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/advisor", advisorRouter);
  app.use("/api/phone", phoneRouter);
  app.use("/api/sms", smsRouter);

  app.use((_req, res) => {
    sendError(res, 404, "Route not found");
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error.message.includes("CORS")) {
      sendError(res, 403, "Origin not allowed");
      return;
    }

    log("error", "http.unhandled", { error: error.message });
    sendError(res, 500, "Unexpected server error");
  });

  return app;
};
