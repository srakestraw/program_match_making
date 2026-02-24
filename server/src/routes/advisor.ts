import { LeadStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendError, sendValidationError } from "../lib/http.js";

const leadStatusSchema = z.nativeEnum(LeadStatus);

const listQuerySchema = z.object({
  status: leadStatusSchema.optional(),
  mode: z.enum(["voice", "chat", "quiz"]).optional(),
  programId: z.string().min(1).optional(),
  q: z.string().trim().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const idParamSchema = z.object({ id: z.string().min(1) });

const detailQuerySchema = z.object({
  sessionId: z.string().min(1).optional()
});

const updateLeadSchema = z.object({
  status: leadStatusSchema.optional(),
  owner: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  lastContactedAt: z.string().datetime().nullable().optional()
});

const toNull = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseEvidence = (raw: string) => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
};

const buildScorecard = (scorecard: {
  id: string;
  sessionId: string;
  overallScore: number;
  createdAt: Date;
  traitScores: Array<{
    traitId: string;
    bucket: string;
    score0to5: number;
    confidence: number;
    evidenceJson: string;
    trait: { name: string };
  }>;
}) => ({
  id: scorecard.id,
  sessionId: scorecard.sessionId,
  overallScore: scorecard.overallScore,
  createdAt: scorecard.createdAt.toISOString(),
  perTrait: scorecard.traitScores.map((item) => ({
    traitId: item.traitId,
    traitName: item.trait.name,
    bucket: item.bucket,
    score0to5: item.score0to5,
    confidence: item.confidence,
    evidence: parseEvidence(item.evidenceJson)
  }))
});

export const advisorRouter = Router();

advisorRouter.get("/programs", async (_req, res) => {
  try {
    const programs = await prisma.program.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });

    res.json({ data: programs });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not fetch programs");
  }
});

advisorRouter.get("/leads", async (req, res) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const limit = query.limit ?? 25;
    const offset = query.offset ?? 0;

    const leads = await prisma.lead.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {})
              }
            }
          : {}),
        ...(query.mode
          ? {
              candidate: {
                sessions: {
                  some: { mode: query.mode }
                }
              }
            }
          : {}),
        ...(query.q
          ? {
              candidate: {
                OR: [
                  { firstName: { contains: query.q } },
                  { lastName: { contains: query.q } },
                  { email: { contains: query.q } },
                  { phone: { contains: query.q } }
                ]
              }
            }
          : {})
      },
      include: {
        candidate: {
          include: {
            sessions: {
              ...(query.mode ? { where: { mode: query.mode } } : {}),
              orderBy: { startedAt: "desc" },
              take: 1,
              include: {
                program: {
                  select: { id: true, name: true }
                },
                scorecards: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  include: {
                    traitScores: true
                  }
                },
                callSessions: {
                  orderBy: { createdAt: "desc" },
                  take: 1
                },
                smsSessions: {
                  orderBy: { createdAt: "desc" },
                  take: 1
                }
              }
            }
          }
        },
        program: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit
    });

    const total = await prisma.lead.count({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {})
              }
            }
          : {}),
        ...(query.mode
          ? {
              candidate: {
                sessions: {
                  some: { mode: query.mode }
                }
              }
            }
          : {}),
        ...(query.q
          ? {
              candidate: {
                OR: [
                  { firstName: { contains: query.q } },
                  { lastName: { contains: query.q } },
                  { email: { contains: query.q } },
                  { phone: { contains: query.q } }
                ]
              }
            }
          : {})
      }
    });

    res.json({
      data: leads.map((lead) => {
        const latestSession = lead.candidate.sessions[0] ?? null;
        const latestScorecard = latestSession?.scorecards[0] ?? null;
        const avgConfidence =
          latestScorecard && latestScorecard.traitScores.length > 0
            ? latestScorecard.traitScores.reduce((acc, item) => acc + item.confidence, 0) / latestScorecard.traitScores.length
            : null;

        return {
          id: lead.id,
          createdAt: lead.createdAt.toISOString(),
          updatedAt: lead.updatedAt.toISOString(),
          status: lead.status,
          owner: lead.owner,
          candidate: {
            id: lead.candidate.id,
            firstName: lead.candidate.firstName,
            lastName: lead.candidate.lastName,
            email: lead.candidate.email,
            phone: lead.candidate.phone,
            preferredChannel: lead.candidate.preferredChannel
          },
          program: lead.program ?? latestSession?.program ?? null,
          latestSession: latestSession
            ? {
                id: latestSession.id,
                mode: latestSession.mode,
                channel: latestSession.channel,
                status: latestSession.status,
                startedAt: latestSession.startedAt.toISOString(),
                endedAt: latestSession.endedAt?.toISOString() ?? null,
                latestCall:
                  latestSession.callSessions[0] === undefined
                    ? null
                    : {
                        id: latestSession.callSessions[0].id,
                        status: latestSession.callSessions[0].status,
                        twilioCallSid: latestSession.callSessions[0].twilioCallSid,
                        createdAt: latestSession.callSessions[0].createdAt.toISOString()
                      },
                latestSms:
                  latestSession.smsSessions[0] === undefined
                    ? null
                    : {
                        id: latestSession.smsSessions[0].id,
                        status: latestSession.smsSessions[0].status,
                        phone: latestSession.smsSessions[0].phone,
                        createdAt: latestSession.smsSessions[0].createdAt.toISOString()
                      }
              }
            : null,
          scoreSummary: latestScorecard
            ? {
                scorecardId: latestScorecard.id,
                overallScore: latestScorecard.overallScore,
                confidence: avgConfidence
              }
            : null
        };
      }),
      pagination: {
        limit,
        offset,
        total
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not fetch leads");
  }
});

advisorRouter.get("/leads/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { sessionId } = detailQuerySchema.parse(req.query);

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        candidate: {
          include: {
            sessions: {
              orderBy: { startedAt: "desc" },
              include: {
                program: {
                  select: { id: true, name: true }
                },
                scorecards: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    traitScores: {
                      include: {
                        trait: {
                          select: { name: true }
                        }
                      }
                    }
                  }
                },
                callSessions: {
                  orderBy: { createdAt: "desc" }
                },
                smsSessions: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    messages: {
                      orderBy: { createdAt: "desc" },
                      take: 50
                    }
                  }
                }
              }
            }
          }
        },
        program: {
          select: { id: true, name: true }
        }
      }
    });

    if (!lead) {
      sendError(res, 404, "Lead not found");
      return;
    }

    const selectedSession =
      (sessionId ? lead.candidate.sessions.find((session) => session.id === sessionId) : null) ??
      lead.candidate.sessions[0] ??
      null;

    const transcript = selectedSession
      ? await prisma.transcriptTurn.findMany({
          where: { sessionId: selectedSession.id },
          orderBy: { ts: "asc" }
        })
      : [];

    const scorecard = selectedSession?.scorecards[0] ?? null;

    res.json({
      data: {
        id: lead.id,
        source: lead.source,
        status: lead.status,
        owner: lead.owner,
        notes: lead.notes,
        lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        candidate: {
          id: lead.candidate.id,
          firstName: lead.candidate.firstName,
          lastName: lead.candidate.lastName,
          email: lead.candidate.email,
          phone: lead.candidate.phone,
          preferredChannel: lead.candidate.preferredChannel,
          createdAt: lead.candidate.createdAt.toISOString(),
          updatedAt: lead.candidate.updatedAt.toISOString()
        },
        program: lead.program,
        sessions: lead.candidate.sessions.map((session) => ({
          id: session.id,
          mode: session.mode,
          channel: session.channel,
          status: session.status,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt?.toISOString() ?? null,
          program: session.program,
          callSessions: session.callSessions.map((call) => ({
            id: call.id,
            status: call.status,
            toPhone: call.toPhone,
            fromPhone: call.fromPhone,
            twilioCallSid: call.twilioCallSid,
            createdAt: call.createdAt.toISOString(),
            startedAt: call.startedAt?.toISOString() ?? null,
            endedAt: call.endedAt?.toISOString() ?? null,
            failureReason: call.failureReason
          })),
          smsSessions: session.smsSessions.map((sms) => ({
            id: sms.id,
            status: sms.status,
            phone: sms.phone,
            currentStep: sms.currentStep,
            optedOutAt: sms.optedOutAt?.toISOString() ?? null,
            createdAt: sms.createdAt.toISOString(),
            updatedAt: sms.updatedAt.toISOString(),
            messages: sms.messages.map((message) => ({
              id: message.id,
              direction: message.direction,
              body: message.body,
              twilioMessageSid: message.twilioMessageSid,
              deliveryStatus: message.deliveryStatus,
              errorCode: message.errorCode,
              errorMessage: message.errorMessage,
              createdAt: message.createdAt.toISOString()
            }))
          })),
          latestScorecard: session.scorecards[0]
            ? {
                id: session.scorecards[0].id,
                overallScore: session.scorecards[0].overallScore,
                createdAt: session.scorecards[0].createdAt.toISOString()
              }
            : null
        })),
        selectedSession: selectedSession
          ? {
              id: selectedSession.id,
              mode: selectedSession.mode,
              status: selectedSession.status,
              startedAt: selectedSession.startedAt.toISOString(),
              endedAt: selectedSession.endedAt?.toISOString() ?? null,
              transcript: transcript.map((turn) => ({
                id: turn.id,
                speaker: turn.speaker,
                text: turn.text,
                ts: turn.ts.toISOString()
              }))
            }
          : null,
        scorecard: scorecard ? buildScorecard(scorecard) : null
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not fetch lead detail");
  }
});

advisorRouter.put("/leads/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateLeadSchema.parse(req.body);

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.owner !== undefined ? { owner: toNull(body.owner) } : {}),
        ...(body.notes !== undefined ? { notes: toNull(body.notes) } : {}),
        ...(body.lastContactedAt !== undefined
          ? {
              lastContactedAt: body.lastContactedAt ? new Date(body.lastContactedAt) : null
            }
          : {})
      }
    });

    res.json({
      data: {
        id: lead.id,
        status: lead.status,
        owner: lead.owner,
        notes: lead.notes,
        lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
        updatedAt: lead.updatedAt.toISOString()
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendError(res, 400, error instanceof Error ? error.message : "Could not update lead");
  }
});
