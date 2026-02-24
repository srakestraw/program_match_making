import type { Server } from "node:http";
import { URL } from "node:url";
import { Router } from "express";
import { WebSocketServer, type WebSocket } from "ws";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendError, sendValidationError } from "../lib/http.js";
import { createRateLimiter } from "../lib/rate-limit.js";
import { log } from "../lib/logger.js";
import { getTelephonyProvider } from "./TwilioVoiceAdapter.js";
import { mapTwilioStatusToCallStatus } from "./status.js";
import { TelephonyRealtimeBridge } from "./TelephonyRealtimeBridge.js";
import { createScorecardForSession } from "../routes/sessions.js";

const callRequestSchema = z.object({
  leadId: z.string().min(1).optional(),
  candidateId: z.string().min(1).optional(),
  candidateSessionId: z.string().min(1).optional(),
  programId: z.string().min(1).optional(),
  toPhone: z.string().trim().min(7).max(40),
  fromPhone: z.string().trim().min(7).max(40).optional(),
  script: z.enum(["default"]).optional()
});

const twilioStatusSchema = z.object({
  CallSid: z.string().min(1),
  CallStatus: z.string().min(1),
  CallDuration: z.string().optional(),
  CallStatusTimestamp: z.string().optional(),
  token: z.string().optional()
});

const twilioVoiceQuerySchema = z.object({
  callSessionId: z.string().min(1),
  token: z.string().optional()
});

const callRateLimit = createRateLimiter({
  name: "phone-calls",
  windowMs: Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.PHONE_RATE_LIMIT_CALLS_MAX ?? 10)
});

const verifyWebhookAuth = (token?: string | null) => {
  const configured = process.env.TWILIO_WEBHOOK_AUTH_SECRET;
  if (!configured) return true;
  return token === configured;
};

const webhookBaseUrl = () => {
  const base = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (!base) throw new Error("TWILIO_WEBHOOK_BASE_URL is not configured");
  return base.replace(/\/$/, "");
};

const toTwiMl = (streamUrl: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello, this is Program Match Making. We are starting your interview now.</Say>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
  <Pause length="300" />
</Response>`;

export const phoneRouter = Router();

phoneRouter.post("/calls", callRateLimit, async (req, res) => {
  try {
    const body = callRequestSchema.parse(req.body);

    const lead = body.leadId
      ? await prisma.lead.findUnique({
          where: { id: body.leadId },
          include: { candidate: true }
        })
      : null;

    const candidateId = body.candidateId ?? lead?.candidateId ?? undefined;
    const programId = body.programId ?? lead?.programId ?? undefined;
    const fromPhone = body.fromPhone ?? process.env.TWILIO_FROM_NUMBER;

    if (!fromPhone) {
      sendError(res, 400, "fromPhone is required or configure TWILIO_FROM_NUMBER");
      return;
    }

    const candidateSession = body.candidateSessionId
      ? await prisma.candidateSession.findUnique({ where: { id: body.candidateSessionId } })
      : await prisma.candidateSession.create({
          data: {
            candidateId,
            programId,
            mode: "voice",
            channel: "PHONE_VOICE",
            status: "active"
          }
        });

    if (!candidateSession) {
      sendError(res, 404, "Candidate session not found");
      return;
    }

    const callSession = await prisma.callSession.create({
      data: {
        candidateSessionId: candidateSession.id,
        leadId: body.leadId,
        toPhone: body.toPhone,
        fromPhone,
        provider: "twilio",
        status: "INITIATED"
      }
    });

    const provider = getTelephonyProvider();
    const token = process.env.TWILIO_WEBHOOK_AUTH_SECRET ?? "";
    const baseUrl = webhookBaseUrl();

    const response = await provider.createOutboundCall({
      toPhone: body.toPhone,
      fromPhone,
      voiceWebhookUrl: `${baseUrl}/api/phone/twilio/voice?callSessionId=${callSession.id}&token=${encodeURIComponent(token)}`,
      statusWebhookUrl: `${baseUrl}/api/phone/twilio/status?callSessionId=${callSession.id}&token=${encodeURIComponent(token)}`
    });

    await prisma.callSession.update({
      where: { id: callSession.id },
      data: {
        twilioCallSid: response.sid,
        status: "RINGING"
      }
    });

    res.status(201).json({
      callSessionId: callSession.id,
      candidateSessionId: candidateSession.id,
      twilioCallSid: response.sid
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not create phone call");
  }
});

phoneRouter.post("/twilio/voice", async (req, res) => {
  try {
    const query = twilioVoiceQuerySchema.parse(req.query);
    const token = query.token ?? (req.headers["x-twilio-webhook-secret"] as string | undefined);

    if (!verifyWebhookAuth(token)) {
      sendError(res, 403, "Invalid Twilio webhook token");
      return;
    }

    const base = webhookBaseUrl();
    const streamUrl = `${base.replace(/^http/, "ws")}/api/phone/twilio/stream?callSessionId=${query.callSessionId}&token=${encodeURIComponent(
      process.env.TWILIO_WEBHOOK_AUTH_SECRET ?? ""
    )}`;

    res.setHeader("Content-Type", "text/xml");
    res.send(toTwiMl(streamUrl));
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not generate TwiML");
  }
});

phoneRouter.post("/twilio/status", async (req, res) => {
  try {
    const queryCallSessionId = typeof req.query.callSessionId === "string" ? req.query.callSessionId : undefined;
    const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;

    const payload = twilioStatusSchema.parse(req.body);
    const token = queryToken ?? payload.token ?? (req.headers["x-twilio-webhook-secret"] as string | undefined);

    if (!verifyWebhookAuth(token)) {
      sendError(res, 403, "Invalid Twilio webhook token");
      return;
    }

    const mapped = mapTwilioStatusToCallStatus(payload.CallStatus);

    const callSession = await prisma.callSession.findFirst({
      where: queryCallSessionId
        ? { id: queryCallSessionId }
        : {
            twilioCallSid: payload.CallSid
          },
      include: {
        candidateSession: true
      }
    });

    if (!callSession) {
      sendError(res, 404, "Call session not found");
      return;
    }

    await prisma.callSession.update({
      where: { id: callSession.id },
      data: {
        twilioCallSid: payload.CallSid,
        status: mapped,
        ...(mapped === "IN_PROGRESS" && !callSession.startedAt ? { startedAt: new Date() } : {}),
        ...(mapped === "COMPLETED" || mapped === "FAILED" || mapped === "NO_ANSWER" || mapped === "BUSY" || mapped === "CANCELED"
          ? {
              endedAt: new Date(),
              ...(mapped !== "COMPLETED" ? { failureReason: payload.CallStatus } : {})
            }
          : {})
      }
    });

    if (mapped === "COMPLETED") {
      await prisma.candidateSession.update({
        where: { id: callSession.candidateSessionId },
        data: {
          status: "completed",
          endedAt: new Date(),
          channel: "PHONE_VOICE"
        }
      });

      try {
        const transcriptCount = await prisma.transcriptTurn.count({ where: { sessionId: callSession.candidateSessionId } });
        const programId = callSession.candidateSession.programId;
        if (transcriptCount > 0 && programId) {
          await createScorecardForSession({
            sessionId: callSession.candidateSessionId,
            mode: "chat",
            programId
          });
        }
      } catch (scoreError) {
        await prisma.callSession.update({
          where: { id: callSession.id },
          data: {
            failureReason: `Scoring failed: ${scoreError instanceof Error ? scoreError.message : String(scoreError)}`
          }
        });
      }
    }

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not process Twilio status callback");
  }
});

type ConnectionState = {
  callSessionId: string;
  bridge: TelephonyRealtimeBridge;
};

const socketState = new WeakMap<WebSocket, ConnectionState>();

const handleStreamMessage = async (socket: WebSocket, raw: string) => {
  const parsed = JSON.parse(raw);

  const state = socketState.get(socket);
  if (!state) return;

  if (parsed.event === "start") {
    const streamSid = String(parsed.start?.streamSid ?? "");
    if (streamSid.length > 0) {
      await state.bridge.onStart({ streamSid });
    }
    return;
  }

  if (parsed.event === "media") {
    const payload = String(parsed.media?.payload ?? "");
    if (payload.length > 0) {
      await state.bridge.onMedia(payload);
    }
    return;
  }

  if (parsed.event === "stop") {
    await state.bridge.onStop();
  }
};

export const attachPhoneWebsocketServer = (server: Server) => {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    try {
      const host = request.headers.host ?? "localhost";
      const url = new URL(request.url ?? "", `http://${host}`);

      if (url.pathname !== "/api/phone/twilio/stream") {
        return;
      }

      const token = url.searchParams.get("token");
      if (!verifyWebhookAuth(token)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      const callSessionId = url.searchParams.get("callSessionId");
      if (!callSessionId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      const callSession = await prisma.callSession.findUnique({
        where: { id: callSessionId },
        include: {
          candidateSession: true
        }
      });

      if (!callSession) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        const bridge = new TelephonyRealtimeBridge({
          callSessionId,
          candidateSessionId: callSession.candidateSessionId,
          programId: callSession.candidateSession.programId
        });

        socketState.set(ws, { callSessionId, bridge });

        ws.on("message", (data) => {
          void handleStreamMessage(ws, data.toString()).catch((error) => {
            log("error", "phone.stream.message_failed", {
              callSessionId,
              error: error instanceof Error ? error.message : String(error)
            });
          });
        });

        ws.on("close", () => {
          const state = socketState.get(ws);
          if (state) {
            void state.bridge.onStop();
          }
        });
      });
    } catch (error) {
      log("error", "phone.stream.upgrade_failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    }
  });
};
