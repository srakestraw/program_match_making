import { z } from "zod";

const baseErrorSchema = z.object({
  error: z
    .union([
      z.string(),
      z.object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional()
      })
    ])
    .optional()
});

const bucketSchema = z.enum(["CRITICAL", "VERY_IMPORTANT", "IMPORTANT", "NICE_TO_HAVE"]);
const leadStatusSchema = z.enum(["NEW", "CONTACTED", "QUALIFIED", "APPLIED", "DISQUALIFIED"]);
const preferredChannelSchema = z.enum(["email", "sms", "phone"]);

export const transcriptTurnSchema = z.object({
  ts: z.string(),
  speaker: z.enum(["candidate", "assistant"]),
  text: z.string()
});

const sessionSchema = z.object({ id: z.string(), status: z.string(), startedAt: z.string() });
const scoringSnapshotSchema = z.object({
  traits: z.array(
    z.object({
      traitId: z.string(),
      traitName: z.string(),
      score_1_to_5: z.number().nullable(),
      confidence: z.enum(["low", "medium", "high"]).nullable(),
      evidence: z.array(z.string()),
      rationale: z.string().nullable(),
      status: z.enum(["unanswered", "active", "complete"])
    })
  )
});

const programFitSchema = z.object({
  programs: z.array(
    z.object({
      programId: z.string(),
      programName: z.string(),
      fitScore_0_to_100: z.number(),
      confidence_0_to_1: z.number().optional(),
      deltaFromLast_0_to_100: z.number().optional(),
      explainability: z
        .object({
          topContributors: z.array(
            z.object({
              traitId: z.string(),
              traitName: z.string(),
              contribution: z.number()
            })
          ),
          gaps: z.array(
            z.object({
              traitId: z.string(),
              traitName: z.string(),
              reason: z.enum(["low_score", "low_confidence", "missing"])
            })
          ),
          suggestions: z.array(
            z.object({
              traitId: z.string(),
              traitName: z.string(),
              reason: z.string()
            })
          )
        })
        .optional(),
      topTraits: z.array(
        z.object({
          traitName: z.string(),
          delta: z.number()
        })
      )
    })
  ),
  selectedProgramId: z.string().nullable()
});

const liveInsightSchema = z.object({
  scoring_snapshot: scoringSnapshotSchema,
  program_fit: programFitSchema
});

const sessionWithInsightsSchema = sessionSchema.extend({
  scoring_snapshot: scoringSnapshotSchema.optional(),
  program_fit: programFitSchema.optional(),
  sessionId: z.string().optional(),
  initialPrompt: z.string().optional(),
  nextQuestion: z
    .object({
      id: z.string(),
      traitId: z.string(),
      traitName: z.string(),
      prompt: z.string(),
      type: z.enum(["chat", "quiz"]),
      options: z.array(z.string())
    })
    .nullable()
    .optional(),
  prefetchedQuestions: z
    .array(
      z.object({
        id: z.string(),
        traitId: z.string(),
        traitName: z.string(),
        prompt: z.string(),
        type: z.enum(["chat", "quiz"]),
        options: z.array(z.string())
      })
    )
    .optional(),
  answeredTraitCount: z.number().int().optional(),
  checkpoint: z
    .object({
      required: z.boolean(),
      answeredTraitCount: z.number().int(),
      prompt: z.string(),
      suggestedTraitIds: z.array(z.string())
    })
    .nullable()
    .optional()
});

const completeSessionSchema = z.object({
  id: z.string(),
  status: z.string(),
  endedAt: z.string().nullable(),
  done: z.boolean().optional(),
  scoring_snapshot: scoringSnapshotSchema.optional(),
  program_fit: programFitSchema.optional()
});

const publicProgramSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable()
});

const programQuestionSchema = z.object({
  id: z.string(),
  traitId: z.string(),
  prompt: z.string(),
  type: z.enum(["chat", "quiz"]),
  options: z.array(z.string()),
  traitName: z.string(),
  bucket: bucketSchema,
  traitSortOrder: z.number().int()
});

const scorecardSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  programId: z.string(),
  overallScore: z.number(),
  createdAt: z.string(),
  perTrait: z.array(
    z.object({
      traitId: z.string(),
      traitName: z.string(),
      bucket: bucketSchema,
      score0to5: z.number(),
      evidence: z.array(z.string()),
      matched_positive_signals: z.array(z.string()).optional(),
      matched_negative_signals: z.array(z.string()).optional(),
      confidence: z.number(),
      rationale: z.string().nullable().optional()
    })
  )
});

const scorecardWithInsightsSchema = scorecardSchema.extend({
  scoring_snapshot: scoringSnapshotSchema,
  program_fit: programFitSchema
});

const advisorLeadListItemSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: leadStatusSchema,
  owner: z.string().nullable(),
  candidate: z.object({
    id: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    preferredChannel: preferredChannelSchema.nullable()
  }),
  program: z
    .object({
      id: z.string(),
      name: z.string()
    })
    .nullable(),
  latestSession: z
    .object({
      id: z.string(),
      mode: z.string(),
      channel: z.string(),
      status: z.string(),
      startedAt: z.string(),
      endedAt: z.string().nullable(),
      latestCall: z
        .object({
          id: z.string(),
          status: z.string(),
          twilioCallSid: z.string().nullable(),
          createdAt: z.string()
        })
        .nullable(),
      latestSms: z
        .object({
          id: z.string(),
          status: z.string(),
          phone: z.string(),
          createdAt: z.string()
        })
        .nullable()
    })
    .nullable(),
  scoreSummary: z
    .object({
      scorecardId: z.string(),
      overallScore: z.number(),
      confidence: z.number().nullable()
    })
    .nullable()
});

const advisorLeadDetailSchema = z.object({
  id: z.string(),
  source: z.enum(["widget", "import"]),
  status: leadStatusSchema,
  owner: z.string().nullable(),
  notes: z.string().nullable(),
  lastContactedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  candidate: z.object({
    id: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    preferredChannel: preferredChannelSchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string()
  }),
  program: z
    .object({
      id: z.string(),
      name: z.string()
    })
    .nullable(),
  sessions: z.array(
    z.object({
      id: z.string(),
      mode: z.string(),
      channel: z.string(),
      status: z.string(),
      startedAt: z.string(),
      endedAt: z.string().nullable(),
      program: z
        .object({
          id: z.string(),
          name: z.string()
        })
        .nullable(),
      latestScorecard: z
        .object({
          id: z.string(),
          overallScore: z.number(),
          createdAt: z.string()
        })
        .nullable(),
      callSessions: z.array(
        z.object({
          id: z.string(),
          status: z.string(),
          toPhone: z.string(),
          fromPhone: z.string(),
          twilioCallSid: z.string().nullable(),
          createdAt: z.string(),
          startedAt: z.string().nullable(),
          endedAt: z.string().nullable(),
          failureReason: z.string().nullable()
        })
      ),
      smsSessions: z.array(
        z.object({
          id: z.string(),
          status: z.string(),
          phone: z.string(),
          currentStep: z.number().int(),
          optedOutAt: z.string().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
          messages: z.array(
            z.object({
              id: z.string(),
              direction: z.enum(["INBOUND", "OUTBOUND"]),
              body: z.string(),
              twilioMessageSid: z.string().nullable(),
              deliveryStatus: z.enum(["QUEUED", "SENT", "DELIVERED", "FAILED", "UNDELIVERED", "RECEIVED"]).nullable(),
              errorCode: z.string().nullable(),
              errorMessage: z.string().nullable(),
              createdAt: z.string()
            })
          )
        })
      )
    })
  ),
  selectedSession: z
    .object({
      id: z.string(),
      mode: z.string(),
      status: z.string(),
      startedAt: z.string(),
      endedAt: z.string().nullable(),
      transcript: z.array(
        z.object({
          id: z.string(),
          speaker: z.string(),
          text: z.string(),
          ts: z.string()
        })
      )
    })
    .nullable(),
  scorecard: z
    .object({
      id: z.string(),
      sessionId: z.string(),
      overallScore: z.number(),
      createdAt: z.string(),
      perTrait: z.array(
        z.object({
          traitId: z.string(),
          traitName: z.string(),
          bucket: z.string(),
          score0to5: z.number(),
          confidence: z.number(),
          evidence: z.array(z.string())
        })
      )
    })
    .nullable()
});

const createPhoneCallResponseSchema = z.object({
  callSessionId: z.string(),
  candidateSessionId: z.string(),
  twilioCallSid: z.string()
});

const startSmsResponseSchema = z.object({
  smsSessionId: z.string()
});

const sendSmsResponseSchema = z.object({
  messageId: z.string().nullable(),
  twilioMessageSid: z.string()
});

export type TranscriptTurnInput = z.infer<typeof transcriptTurnSchema>;
export type PublicProgram = z.infer<typeof publicProgramSchema>;
export type ProgramQuestion = z.infer<typeof programQuestionSchema>;
export type Scorecard = z.infer<typeof scorecardSchema>;
export type ScoringSnapshot = z.infer<typeof scoringSnapshotSchema>;
export type ProgramFit = z.infer<typeof programFitSchema>;
export type LeadStatus = z.infer<typeof leadStatusSchema>;
export type AdvisorLeadListItem = z.infer<typeof advisorLeadListItemSchema>;
export type AdvisorLeadDetail = z.infer<typeof advisorLeadDetailSchema>;

export type ApiClientConfig = {
  baseUrl: string;
};

const interviewQuestionSchema = z.object({
  id: z.string(),
  traitId: z.string(),
  traitName: z.string(),
  prompt: z.string(),
  type: z.enum(["chat", "quiz"]),
  options: z.array(z.string())
});

const checkpointSchema = z
  .object({
    required: z.boolean(),
    answeredTraitCount: z.number().int(),
    prompt: z.string(),
    suggestedTraitIds: z.array(z.string())
  })
  .nullable();

const interviewSessionSchema = z.object({
  sessionId: z.string(),
  brandVoiceId: z.string().nullable().optional(),
  realtimeVoiceName: z.string().optional(),
  language: z.string().optional(),
  systemPrompt: z.string().optional(),
  initialPrompt: z.string(),
  scoring_snapshot: scoringSnapshotSchema,
  program_fit: programFitSchema,
  nextQuestion: interviewQuestionSchema.nullable(),
  prefetchedQuestions: z.array(interviewQuestionSchema),
  answeredTraitCount: z.number().int(),
  checkpoint: checkpointSchema
});

const parseResponse = async <T>(response: Response, schema?: z.ZodSchema<T>) => {
  if (!response.ok) {
    const raw = await response.json().catch(() => ({}));
    const parsed = baseErrorSchema.safeParse(raw);
    if (parsed.success) {
      const errorPayload = parsed.data.error;
      if (typeof errorPayload === "string") {
        throw new Error(errorPayload);
      }
      if (errorPayload?.message) {
        throw new Error(errorPayload.message);
      }
    }
    throw new Error("Request failed");
  }

  if (!schema) {
    return undefined as T;
  }

  const data = await response.json();
  return schema.parse(data);
};

const encodeQuery = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query.length > 0 ? `?${query}` : "";
};

export const createApiClient = ({ baseUrl }: ApiClientConfig) => {
  const post = async <T>(path: string, body?: unknown, schema?: z.ZodSchema<T>) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    return parseResponse(response, schema);
  };

  const put = async <T>(path: string, body?: unknown, schema?: z.ZodSchema<T>) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    return parseResponse(response, schema);
  };

  const get = async <T>(path: string, schema: z.ZodSchema<T>) => {
    const response = await fetch(`${baseUrl}${path}`);
    return parseResponse(response, schema);
  };

  return {
    createSession: (
      mode: "voice" | "chat" | "quiz" = "voice",
      options?: { programId?: string; programFilterIds?: string[]; brandVoiceId?: string; candidateId?: string }
    ) =>
      post("/api/sessions", { mode, ...options }, sessionWithInsightsSchema),
    createInterviewSession: (input: {
      mode: "voice" | "chat" | "quiz";
      brandVoiceId?: string;
      candidateId?: string;
      language?: string;
      programFilterIds?: string[];
      programId?: string;
    }) => post("/api/interview/sessions", input, interviewSessionSchema),
    submitInterviewTurn: (
      sessionId: string,
      input: {
        mode: "voice" | "chat" | "quiz";
        text: string;
        language?: string;
        traitId?: string;
        questionId?: string;
        askedTraitIds?: string[];
        askedQuestionIds?: string[];
        preferredTraitIds?: string[];
        programFilterIds?: string[];
      }
    ) =>
      post(
        `/api/interview/sessions/${sessionId}/turns`,
        input,
        z.object({
          scoring_snapshot: scoringSnapshotSchema,
          program_fit: programFitSchema,
          nextQuestion: interviewQuestionSchema.nullable(),
          prefetchedQuestions: z.array(interviewQuestionSchema),
          answeredTraitCount: z.number().int(),
          checkpoint: checkpointSchema
        })
      ),
    submitInterviewCheckpoint: (
      sessionId: string,
      input: {
        mode: "voice" | "chat" | "quiz";
        action: "stop" | "continue" | "focus";
        focusTraitIds?: string[];
        askedTraitIds?: string[];
        askedQuestionIds?: string[];
        programFilterIds?: string[];
      }
    ) =>
      post(
        `/api/interview/sessions/${sessionId}/checkpoint`,
        input,
        z.object({
          nextQuestion: interviewQuestionSchema.nullable(),
          scoring_snapshot: scoringSnapshotSchema,
          program_fit: programFitSchema
        })
      ),
    appendTranscript: (sessionId: string, turns: TranscriptTurnInput[]) => post(`/api/sessions/${sessionId}/transcript`, { turns }),
    completeSession: (sessionId: string) => post(`/api/sessions/${sessionId}/complete`, undefined, completeSessionSchema),
    getRealtimeToken: (input?: { brandVoiceId?: string; voiceName?: string; language?: string }) =>
      post(
        "/api/realtime/token",
        input,
        z.object({
          client_secret: z.object({ value: z.string(), expires_at: z.number().optional() })
        })
      ),
    getPublicPrograms: () => get("/api/public/programs", z.object({ data: z.array(publicProgramSchema) })),
    getPublicProgram: (programId: string) =>
      get(
        `/api/public/programs/${programId}`,
        z.object({
          data: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            traits: z.array(
              z.object({
                id: z.string(),
                traitId: z.string(),
                bucket: bucketSchema,
                sortOrder: z.number().int(),
                notes: z.string().nullable(),
                trait: z.object({
                  id: z.string(),
                  name: z.string(),
                  category: z.string(),
                  definition: z.string().nullable()
                })
              })
            )
          })
        })
      ),
    getProgramQuestions: (programId: string, type: "chat" | "quiz") =>
      get(
        `/api/public/programs/${programId}/questions?type=${type}`,
        z.object({
          data: z.object({
            programId: z.string(),
            type: z.enum(["chat", "quiz", "all"]),
            grouped: z.array(
              z.object({
                traitId: z.string(),
                traitName: z.string(),
                bucket: bucketSchema,
                sortOrder: z.number().int(),
                questions: z.array(
                  z.object({
                    id: z.string(),
                    traitId: z.string(),
                    prompt: z.string(),
                    type: z.enum(["chat", "quiz"]),
                    options: z.array(z.string())
                  })
                )
              })
            ),
            orderedQuestions: z.array(programQuestionSchema)
          })
        })
      ),
    createPublicLead: (input: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      preferredChannel?: "email" | "sms" | "phone";
      programId?: string;
      sessionId?: string;
    }) => post("/api/public/leads", input, z.object({ candidateId: z.string(), leadId: z.string() })),
    scoreSession: (input: {
      sessionId: string;
      mode: "voice" | "chat" | "quiz";
      programId: string;
      transcriptTurns?: TranscriptTurnInput[];
      responses?: Array<{ questionId: string; answer: string }>;
      activeTraitId?: string;
    }) =>
      post(
        `/api/sessions/${input.sessionId}/score`,
        {
          mode: input.mode,
          programId: input.programId,
          transcriptTurns: input.transcriptTurns,
          responses: input.responses,
          activeTraitId: input.activeTraitId
        },
        z.object({ data: scorecardWithInsightsSchema })
      ),
    scoreSessionTurn: (input: {
      sessionId: string;
      mode: "voice" | "chat" | "quiz";
      programId: string;
      transcriptTurns?: TranscriptTurnInput[];
      responses?: Array<{ questionId: string; answer: string }>;
      activeTraitId?: string;
    }) =>
      post(
        "/api/voice/session/turn",
        {
          sessionId: input.sessionId,
          mode: input.mode,
          programId: input.programId,
          transcriptTurns: input.transcriptTurns,
          responses: input.responses,
          activeTraitId: input.activeTraitId
        },
        z.object({ data: scorecardWithInsightsSchema })
      ),
    startVoiceSession: (mode: "voice" | "chat" | "quiz", options?: { programId?: string; candidateId?: string }) =>
      post("/api/voice/session/start", { mode, ...options }, sessionWithInsightsSchema),
    endVoiceSession: (sessionId: string) =>
      post(
        "/api/voice/session/end",
        { sessionId },
        z.object({ id: z.string(), status: z.string(), endedAt: z.string().nullable(), done: z.boolean().optional() }).and(liveInsightSchema.partial())
      ),
    getAdvisorPrograms: () => get("/api/advisor/programs", z.object({ data: z.array(z.object({ id: z.string(), name: z.string() })) })),
    getAdvisorLeads: (filters?: {
      status?: LeadStatus;
      mode?: "voice" | "chat" | "quiz";
      programId?: string;
      q?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    }) =>
      get(
        `/api/advisor/leads${encodeQuery(filters ?? {})}`,
        z.object({
          data: z.array(advisorLeadListItemSchema),
          pagination: z.object({ limit: z.number(), offset: z.number(), total: z.number() })
        })
      ),
    getAdvisorLeadDetail: (leadId: string, sessionId?: string) =>
      get(`/api/advisor/leads/${leadId}${encodeQuery({ sessionId })}`, z.object({ data: advisorLeadDetailSchema })),
    updateAdvisorLead: (
      leadId: string,
      input: { status?: LeadStatus; owner?: string | null; notes?: string | null; lastContactedAt?: string | null }
    ) =>
      put(
        `/api/advisor/leads/${leadId}`,
        input,
        z.object({
          data: z.object({
            id: z.string(),
            status: leadStatusSchema,
            owner: z.string().nullable(),
            notes: z.string().nullable(),
            lastContactedAt: z.string().nullable(),
            updatedAt: z.string()
          })
        })
      ),
    createPhoneCall: (input: {
      leadId?: string;
      candidateId?: string;
      candidateSessionId?: string;
      programId?: string;
      toPhone: string;
      fromPhone?: string;
      script?: "default";
    }) => post("/api/phone/calls", input, createPhoneCallResponseSchema),
    startSmsInterview: (input: { leadId: string; programId?: string }) => post("/api/sms/start", input, startSmsResponseSchema),
    sendSmsMessage: (input: { leadId: string; body: string }) => post("/api/sms/send", input, sendSmsResponseSchema)
  };
};
