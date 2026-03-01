import { Router } from "express";
import { z } from "zod";
import { sendError } from "../lib/http.js";
import { incrementMetric } from "../lib/metrics.js";
import { fetchOpenAiWithRetry } from "../lib/openai.js";
import { createRateLimiter } from "../lib/rate-limit.js";
import { prisma } from "../lib/prisma.js";
import { buildInterviewSystemPrompt, DEFAULT_INTERVIEW_LANGUAGE } from "../lib/interview-language.js";

const tokenBodySchema = z
  .object({
    brandVoiceId: z.string().min(1).optional(),
    voiceName: z.string().trim().min(1).max(80).optional(),
    language: z.string().trim().min(2).max(8).optional(),
    debug: z.boolean().optional()
  })
  .optional();

const allowedVoices = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);

export const realtimeRouter = Router();
const tokenRateLimit = createRateLimiter({
  name: "realtime-token",
  windowMs: Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.PUBLIC_RATE_LIMIT_TOKEN_MAX ?? 30)
});

realtimeRouter.post("/token", tokenRateLimit, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    incrementMetric("realtime.token.failed");
    sendError(res, 500, "OPENAI_API_KEY is not configured", undefined, "OPENAI_KEY_MISSING");
    return;
  }

  try {
    const body = tokenBodySchema.parse(req.body);
    const brandVoice = body?.brandVoiceId
      ? await prisma.brandVoice.findUnique({
          where: { id: body.brandVoiceId },
          select: { id: true, ttsVoiceName: true, primaryTone: true, styleFlags: true }
        })
      : null;
    const rawVoice = body?.voiceName ?? brandVoice?.ttsVoiceName ?? "alloy";
    const selectedVoice = allowedVoices.has(rawVoice) ? rawVoice : "alloy";
    const language = (body?.language ?? DEFAULT_INTERVIEW_LANGUAGE).toLowerCase();
    const instructions = buildInterviewSystemPrompt({
      brandVoicePrompt: brandVoice
        ? `Use a ${brandVoice.primaryTone} tone with these style flags: ${brandVoice.styleFlags.join(", ") || "clear and supportive"}.`
        : null,
      language
    });

    const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: selectedVoice,
        instructions,
        input_audio_transcription: {
          model: "gpt-4o-mini-transcribe",
          language
        }
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
    const debugEnabled = body?.debug || process.env.DEBUG_VOICE === "1";
    if (debugEnabled) {
      res.json({
        ...payload,
        debug: {
          selectedVoice,
          brandVoiceId: brandVoice?.id ?? null,
          language,
          brandVoiceName: brandVoice?.primaryTone ?? null
        }
      });
      return;
    }
    res.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      incrementMetric("realtime.token.failed");
      sendError(res, 400, "Invalid token request payload", error.issues, "REQUEST_ERROR");
      return;
    }
    incrementMetric("realtime.token.failed");
    sendError(res, 502, "Failed to mint realtime token", undefined, "OPENAI_TOKEN_FAILED");
  }
});
