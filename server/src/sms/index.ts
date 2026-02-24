import { SmsDeliveryStatus, SmsDirection, SmsSessionStatus, TraitQuestionType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { upsertCandidate } from "../lib/candidates.js";
import { sendError, sendValidationError } from "../lib/http.js";
import { createRateLimiter } from "../lib/rate-limit.js";
import { log } from "../lib/logger.js";
import { createScorecardForSession } from "../routes/sessions.js";
import { getSmsProvider } from "./TwilioSmsAdapter.js";
import { classifySmsKeyword, getInboundProgressAction } from "./state.js";

const bucketRank = {
  CRITICAL: 0,
  VERY_IMPORTANT: 1,
  IMPORTANT: 2,
  NICE_TO_HAVE: 3
} as const;

const startSchema = z.object({
  leadId: z.string().min(1),
  programId: z.string().min(1).optional()
});

const sendSchema = z.object({
  leadId: z.string().min(1),
  body: z.string().trim().min(1).max(1000)
});

const inboundSchema = z.object({
  From: z.string().trim().min(7).max(40),
  To: z.string().trim().min(7).max(40),
  Body: z.string().trim().min(1).max(1000),
  MessageSid: z.string().trim().min(1).optional(),
  token: z.string().optional()
});

const statusSchema = z.object({
  MessageSid: z.string().min(1),
  MessageStatus: z.string().min(1),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
  token: z.string().optional()
});

const sendRateLimit = createRateLimiter({
  name: "sms-send",
  windowMs: Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.PUBLIC_RATE_LIMIT_SMS_SEND_MAX ?? 30)
});

const startRateLimit = createRateLimiter({
  name: "sms-start",
  windowMs: Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.PUBLIC_RATE_LIMIT_SMS_START_MAX ?? 20)
});

const outboundThrottleMs = 2000;
const outboundLastSentBySession = new Map<string, number>();

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

const toTwiMlResponse = (message?: string) => {
  if (!message) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  }

  const escaped = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
};

const normalizePhone = (value: string) => value.trim();

const mapMessageStatus = (status: string): SmsDeliveryStatus | null => {
  const value = status.trim().toLowerCase();
  if (value === "queued") return SmsDeliveryStatus.QUEUED;
  if (value === "sent" || value === "accepted" || value === "sending") return SmsDeliveryStatus.SENT;
  if (value === "delivered") return SmsDeliveryStatus.DELIVERED;
  if (value === "failed") return SmsDeliveryStatus.FAILED;
  if (value === "undelivered") return SmsDeliveryStatus.UNDELIVERED;
  if (value === "received") return SmsDeliveryStatus.RECEIVED;
  return null;
};

const assertOutboundAllowed = (smsSessionId: string, status: SmsSessionStatus) => {
  if (status === SmsSessionStatus.OPTED_OUT) {
    throw new Error("SMS is opted out for this candidate");
  }

  const now = Date.now();
  const last = outboundLastSentBySession.get(smsSessionId);
  if (last && now - last < outboundThrottleMs) {
    throw new Error("SMS send throttled for this session");
  }

  outboundLastSentBySession.set(smsSessionId, now);
};

const loadInterviewQuestions = async (programId: string | null) => {
  if (!programId) return [] as Array<{ id: string; prompt: string }>;

  const rows = await prisma.programTrait.findMany({
    where: { programId },
    include: {
      trait: {
        include: {
          questions: {
            where: { type: TraitQuestionType.CHAT },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });

  return [...rows]
    .sort((a, b) => {
      const bucketDiff = bucketRank[a.bucket] - bucketRank[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;
      return a.sortOrder - b.sortOrder;
    })
    .flatMap((row) => row.trait.questions.map((question) => ({ id: question.id, prompt: question.prompt })))
    .slice(0, 8);
};

const persistOutboundSystemMessage = async (input: {
  smsSessionId: string;
  candidateSessionId: string;
  body: string;
  twilioMessageSid?: string | null;
  deliveryStatus?: SmsDeliveryStatus;
}) => {
  const now = new Date();

  await prisma.$transaction([
    prisma.smsMessage.create({
      data: {
        smsSessionId: input.smsSessionId,
        direction: SmsDirection.OUTBOUND,
        body: input.body,
        twilioMessageSid: input.twilioMessageSid ?? null,
        deliveryStatus: input.deliveryStatus ?? SmsDeliveryStatus.SENT
      }
    }),
    prisma.transcriptTurn.create({
      data: {
        sessionId: input.candidateSessionId,
        ts: now,
        speaker: "assistant",
        text: input.body
      }
    }),
    prisma.smsSession.update({
      where: { id: input.smsSessionId },
      data: { lastOutboundAt: now }
    })
  ]);
};

const sendSms = async (input: {
  smsSessionId: string;
  candidateSessionId: string;
  toPhone: string;
  body: string;
  status: SmsSessionStatus;
}) => {
  assertOutboundAllowed(input.smsSessionId, input.status);

  const provider = getSmsProvider();
  const token = process.env.TWILIO_WEBHOOK_AUTH_SECRET ?? "";
  const baseUrl = webhookBaseUrl();

  const response = await provider.sendMessage({
    toPhone: input.toPhone,
    body: input.body,
    fromPhone: process.env.TWILIO_FROM_NUMBER,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    statusWebhookUrl: `${baseUrl}/api/sms/twilio/status?token=${encodeURIComponent(token)}`
  });

  await persistOutboundSystemMessage({
    smsSessionId: input.smsSessionId,
    candidateSessionId: input.candidateSessionId,
    body: input.body,
    twilioMessageSid: response.sid,
    deliveryStatus: mapMessageStatus(response.status ?? "sent") ?? SmsDeliveryStatus.SENT
  });

  return response;
};

const getOrCreateSmsSessionForInbound = async (fromPhone: string) => {
  const existing = await prisma.smsSession.findFirst({
    where: { phone: fromPhone },
    orderBy: { updatedAt: "desc" },
    include: {
      candidateSession: true,
      lead: {
        include: {
          candidate: true
        }
      }
    }
  });

  if (existing) return existing;

  const lead = await prisma.lead.findFirst({
    where: {
      candidate: {
        phone: fromPhone
      }
    },
    include: {
      candidate: true
    },
    orderBy: { createdAt: "desc" }
  });

  if (lead) {
    const candidateSession = await prisma.candidateSession.create({
      data: {
        candidateId: lead.candidateId,
        programId: lead.programId,
        mode: "chat",
        channel: "SMS",
        status: "active"
      }
    });

    return prisma.smsSession.create({
      data: {
        candidateSessionId: candidateSession.id,
        leadId: lead.id,
        phone: fromPhone,
        status: SmsSessionStatus.ACTIVE,
        currentStep: -1
      },
      include: {
        candidateSession: true,
        lead: {
          include: {
            candidate: true
          }
        }
      }
    });
  }

  const candidate = await upsertCandidate(prisma, {
    phone: fromPhone
  });

  const createdLead = await prisma.lead.create({
    data: {
      candidateId: candidate.id,
      source: "widget",
      status: "NEW"
    },
    include: {
      candidate: true
    }
  });

  const candidateSession = await prisma.candidateSession.create({
    data: {
      candidateId: candidate.id,
      mode: "chat",
      channel: "SMS",
      status: "active"
    }
  });

  return prisma.smsSession.create({
    data: {
      candidateSessionId: candidateSession.id,
      leadId: createdLead.id,
      phone: fromPhone,
      status: SmsSessionStatus.ACTIVE,
      currentStep: -1
    },
    include: {
      candidateSession: true,
      lead: {
        include: {
          candidate: true
        }
      }
    }
  });
};

export const smsRouter = Router();

smsRouter.post("/start", startRateLimit, async (req, res) => {
  try {
    const body = startSchema.parse(req.body);

    const lead = await prisma.lead.findUnique({
      where: { id: body.leadId },
      include: {
        candidate: true
      }
    });

    if (!lead) {
      sendError(res, 404, "Lead not found");
      return;
    }

    const phone = normalizePhone(lead.candidate.phone ?? "");
    if (!phone) {
      sendError(res, 400, "Lead does not have a phone number");
      return;
    }

    const programId = body.programId ?? lead.programId ?? null;

    const candidateSession = await prisma.candidateSession.create({
      data: {
        candidateId: lead.candidateId,
        programId,
        mode: "chat",
        channel: "SMS",
        status: "active"
      }
    });

    const smsSession = await prisma.smsSession.create({
      data: {
        candidateSessionId: candidateSession.id,
        leadId: lead.id,
        phone,
        status: SmsSessionStatus.ACTIVE,
        currentStep: 0
      }
    });

    const questions = await loadInterviewQuestions(programId);
    if (questions.length > 0) {
      await sendSms({
        smsSessionId: smsSession.id,
        candidateSessionId: candidateSession.id,
        toPhone: phone,
        body: questions[0].prompt,
        status: SmsSessionStatus.ACTIVE
      });
    } else {
      await sendSms({
        smsSessionId: smsSession.id,
        candidateSessionId: candidateSession.id,
        toPhone: phone,
        body: "Thanks for your interest. An advisor will follow up shortly.",
        status: SmsSessionStatus.ACTIVE
      });
    }

    res.status(201).json({ smsSessionId: smsSession.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }

    const message = error instanceof Error ? error.message : "Could not start SMS interview";
    if (message.includes("throttled")) {
      sendError(res, 429, message);
      return;
    }
    sendError(res, 400, message);
  }
});

smsRouter.post("/send", sendRateLimit, async (req, res) => {
  try {
    const body = sendSchema.parse(req.body);

    const lead = await prisma.lead.findUnique({
      where: { id: body.leadId },
      include: {
        candidate: true,
        smsSessions: {
          orderBy: { createdAt: "desc" },
          include: {
            candidateSession: true
          },
          take: 1
        }
      }
    });

    if (!lead) {
      sendError(res, 404, "Lead not found");
      return;
    }

    const phone = normalizePhone(lead.candidate.phone ?? "");
    if (!phone) {
      sendError(res, 400, "Lead does not have a phone number");
      return;
    }

    let smsSession = lead.smsSessions[0] ?? null;
    if (!smsSession) {
      const candidateSession = await prisma.candidateSession.create({
        data: {
          candidateId: lead.candidateId,
          programId: lead.programId,
          mode: "chat",
          channel: "SMS",
          status: "active"
        }
      });

      smsSession = await prisma.smsSession.create({
        data: {
          candidateSessionId: candidateSession.id,
          leadId: lead.id,
          phone,
          status: SmsSessionStatus.ACTIVE
        },
        include: {
          candidateSession: true
        }
      });
    }

    if (smsSession.status === SmsSessionStatus.OPTED_OUT) {
      sendError(res, 409, "Candidate has opted out of SMS", undefined, "SMS_OPTED_OUT");
      return;
    }

    const sent = await sendSms({
      smsSessionId: smsSession.id,
      candidateSessionId: smsSession.candidateSessionId,
      toPhone: phone,
      body: body.body,
      status: smsSession.status
    });

    const message = await prisma.smsMessage.findFirst({
      where: { twilioMessageSid: sent.sid },
      orderBy: { createdAt: "desc" }
    });

    res.status(201).json({
      messageId: message?.id ?? null,
      twilioMessageSid: sent.sid
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }

    const message = error instanceof Error ? error.message : "Could not send SMS";
    if (message.includes("opted out")) {
      sendError(res, 409, message, undefined, "SMS_OPTED_OUT");
      return;
    }
    if (message.includes("throttled")) {
      sendError(res, 429, message);
      return;
    }
    sendError(res, 400, message);
  }
});

smsRouter.post("/twilio/inbound", async (req, res) => {
  try {
    const body = inboundSchema.parse(req.body);
    const token =
      body.token ??
      (typeof req.query.token === "string" ? req.query.token : undefined) ??
      (req.headers["x-twilio-webhook-secret"] as string | undefined);

    if (!verifyWebhookAuth(token)) {
      sendError(res, 403, "Invalid Twilio webhook token");
      return;
    }

    const fromPhone = normalizePhone(body.From);
    const smsSession = await getOrCreateSmsSessionForInbound(fromPhone);
    const now = new Date();

    await prisma.$transaction([
      prisma.smsMessage.create({
        data: {
          smsSessionId: smsSession.id,
          direction: SmsDirection.INBOUND,
          body: body.Body,
          twilioMessageSid: body.MessageSid ?? null,
          deliveryStatus: SmsDeliveryStatus.RECEIVED
        }
      }),
      prisma.transcriptTurn.create({
        data: {
          sessionId: smsSession.candidateSessionId,
          ts: now,
          speaker: "candidate",
          text: body.Body
        }
      }),
      prisma.smsSession.update({
        where: { id: smsSession.id },
        data: {
          lastInboundAt: now
        }
      })
    ]);

    const keyword = classifySmsKeyword(body.Body);

    if (keyword === "STOP") {
      await prisma.smsSession.update({
        where: { id: smsSession.id },
        data: {
          status: SmsSessionStatus.OPTED_OUT,
          optedOutAt: now
        }
      });

      await persistOutboundSystemMessage({
        smsSessionId: smsSession.id,
        candidateSessionId: smsSession.candidateSessionId,
        body: "You have been opted out. Reply START to opt back in.",
        deliveryStatus: SmsDeliveryStatus.SENT
      });

      res.setHeader("Content-Type", "text/xml");
      res.send(toTwiMlResponse("You have been opted out. Reply START to opt back in."));
      return;
    }

    if (smsSession.status === SmsSessionStatus.OPTED_OUT && keyword !== "START") {
      res.setHeader("Content-Type", "text/xml");
      res.send(toTwiMlResponse("You are opted out. Reply START to resume SMS messages."));
      return;
    }

    const questions = await loadInterviewQuestions(smsSession.candidateSession.programId);
    const action = getInboundProgressAction({
      status: smsSession.status,
      currentStep: smsSession.currentStep,
      totalQuestions: questions.length,
      inboundBody: body.Body
    });

    if (action.kind === "opt_in") {
      const question = questions[smsSession.currentStep] ?? questions[0];
      await prisma.smsSession.update({
        where: { id: smsSession.id },
        data: {
          status: SmsSessionStatus.ACTIVE,
          optedOutAt: null
        }
      });

      if (question) {
        await sendSms({
          smsSessionId: smsSession.id,
          candidateSessionId: smsSession.candidateSessionId,
          toPhone: smsSession.phone,
          body: question.prompt,
          status: SmsSessionStatus.ACTIVE
        });
      }

      res.setHeader("Content-Type", "text/xml");
      res.send(toTwiMlResponse());
      return;
    }

    if (action.kind === "ignored_opted_out") {
      res.setHeader("Content-Type", "text/xml");
      res.send(toTwiMlResponse("You are opted out. Reply START to resume SMS messages."));
      return;
    }

    if (action.kind === "ask_next") {
      const question = questions[action.questionIndex];
      if (question) {
        await prisma.smsSession.update({
          where: { id: smsSession.id },
          data: {
            currentStep: action.nextStep,
            status: SmsSessionStatus.ACTIVE
          }
        });

        await sendSms({
          smsSessionId: smsSession.id,
          candidateSessionId: smsSession.candidateSessionId,
          toPhone: smsSession.phone,
          body: question.prompt,
          status: SmsSessionStatus.ACTIVE
        });
      }

      res.setHeader("Content-Type", "text/xml");
      res.send(toTwiMlResponse());
      return;
    }

    const completedStep = action.kind === "complete" ? action.nextStep : smsSession.currentStep;

    await prisma.smsSession.update({
      where: { id: smsSession.id },
      data: {
        status: SmsSessionStatus.COMPLETED,
        currentStep: completedStep
      }
    });

    await prisma.candidateSession.update({
      where: { id: smsSession.candidateSessionId },
      data: {
        status: "completed",
        endedAt: new Date(),
        channel: "SMS"
      }
    });

    let completionMessage = "Thanks for completing the SMS interview. We will follow up soon.";

    try {
      const transcriptCount = await prisma.transcriptTurn.count({ where: { sessionId: smsSession.candidateSessionId } });
      if (transcriptCount > 0 && smsSession.candidateSession.programId) {
        const scorecard = await createScorecardForSession({
          sessionId: smsSession.candidateSessionId,
          mode: "chat",
          programId: smsSession.candidateSession.programId
        });
        completionMessage = `Thanks for completing the interview. Your overall match score is ${scorecard.overallScore.toFixed(2)}.`;
      }
    } catch (error) {
      log("warn", "sms.scoring_failed", {
        smsSessionId: smsSession.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    await sendSms({
      smsSessionId: smsSession.id,
      candidateSessionId: smsSession.candidateSessionId,
      toPhone: smsSession.phone,
      body: completionMessage,
      status: SmsSessionStatus.COMPLETED
    });

    res.setHeader("Content-Type", "text/xml");
    res.send(toTwiMlResponse());
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }

    const message = error instanceof Error ? error.message : "Could not process inbound SMS";
    if (message.includes("throttled")) {
      sendError(res, 429, message);
      return;
    }
    sendError(res, 400, message);
  }
});

smsRouter.post("/twilio/status", async (req, res) => {
  try {
    const body = statusSchema.parse(req.body);
    const token =
      body.token ??
      (typeof req.query.token === "string" ? req.query.token : undefined) ??
      (req.headers["x-twilio-webhook-secret"] as string | undefined);

    if (!verifyWebhookAuth(token)) {
      sendError(res, 403, "Invalid Twilio webhook token");
      return;
    }

    const message = await prisma.smsMessage.findFirst({
      where: { twilioMessageSid: body.MessageSid },
      orderBy: { createdAt: "desc" }
    });

    if (!message) {
      res.json({ ok: true });
      return;
    }

    await prisma.smsMessage.update({
      where: { id: message.id },
      data: {
        deliveryStatus: mapMessageStatus(body.MessageStatus) ?? undefined,
        errorCode: body.ErrorCode ?? null,
        errorMessage: body.ErrorMessage ?? null
      }
    });

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not process Twilio SMS status callback");
  }
});
