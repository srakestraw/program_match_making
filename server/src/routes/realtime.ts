import { Router } from "express";
import { sendError } from "../lib/http.js";
import { incrementMetric } from "../lib/metrics.js";
import { fetchOpenAiWithRetry } from "../lib/openai.js";
import { createRateLimiter } from "../lib/rate-limit.js";

export const realtimeRouter = Router();
const tokenRateLimit = createRateLimiter({
  name: "realtime-token",
  windowMs: Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.PUBLIC_RATE_LIMIT_TOKEN_MAX ?? 30)
});

realtimeRouter.post("/token", tokenRateLimit, async (_req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    incrementMetric("realtime.token.failed");
    sendError(res, 500, "OPENAI_API_KEY is not configured", undefined, "OPENAI_KEY_MISSING");
    return;
  }

  try {
    const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: "alloy"
      })
    });

    const payload: any = await response.json();

    if (!response.ok) {
      const errorMessage = typeof payload?.error?.message === "string" ? payload.error.message : "Failed to mint realtime token";
      incrementMetric("realtime.token.failed");
      sendError(res, response.status >= 500 ? 502 : response.status, errorMessage, undefined, "OPENAI_TOKEN_FAILED");
      return;
    }

    incrementMetric("realtime.token.success");
    res.json(payload);
  } catch {
    incrementMetric("realtime.token.failed");
    sendError(res, 502, "Failed to mint realtime token", undefined, "OPENAI_TOKEN_FAILED");
  }
});
