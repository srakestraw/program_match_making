import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setTelephonyProviderForTests } from "../src/phone/TwilioVoiceAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// DATABASE_URL from .env (RDS PostgreSQL)

let prisma: typeof import("../src/lib/prisma.js")["prisma"];
let createApp: typeof import("../src/app.js")["createApp"];

describe.sequential("phone calling integration", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    setTelephonyProviderForTests(null);
    await prisma.$disconnect();
  });

  it("creates outbound call and handles completion callback with scorecard generation", async () => {
    const suffix = Date.now().toString(36);
    const twilioSid = `CA_test_${suffix}`;

    const candidate = await prisma.candidate.create({
      data: {
        firstName: "Phone",
        lastName: "Candidate",
        phone: "+15550001111"
      }
    });

    const trait = await prisma.trait.create({
      data: {
        name: `Phone Trait ${suffix}`,
        category: "MOTIVATION",
        rubricScaleMin: 0,
        rubricScaleMax: 5
      }
    });

    const program = await prisma.program.create({
      data: {
        name: `Phone Program ${suffix}`,
        isActive: true
      }
    });

    await prisma.programTrait.create({
      data: {
        programId: program.id,
        traitId: trait.id,
        bucket: "CRITICAL",
        sortOrder: 0
      }
    });

    const lead = await prisma.lead.create({
      data: {
        candidateId: candidate.id,
        programId: program.id,
        status: "NEW"
      }
    });

    setTelephonyProviderForTests({
      createOutboundCall: vi.fn().mockResolvedValue({ sid: twilioSid, status: "queued" })
    });
    process.env.TWILIO_WEBHOOK_BASE_URL = "https://example.ngrok-free.app";

    const app = createApp();

    const createResponse = await request(app).post("/api/phone/calls").send({
      leadId: lead.id,
      toPhone: "+15550001111",
      fromPhone: "+15550002222",
      script: "default"
    });

    expect(createResponse.status).toBe(201);

    const callSessionId = createResponse.body.callSessionId as string;
    const candidateSessionId = createResponse.body.candidateSessionId as string;

    const callSession = await prisma.callSession.findUnique({ where: { id: callSessionId } });
    expect(callSession?.status).toBe("RINGING");
    expect(callSession?.twilioCallSid).toBe(twilioSid);

    await prisma.transcriptTurn.createMany({
      data: [
        { sessionId: candidateSessionId, ts: new Date(), speaker: "assistant", text: "Tell me about your goals." },
        { sessionId: candidateSessionId, ts: new Date(), speaker: "candidate", text: "I plan to pursue leadership." }
      ]
    });

    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                perTrait: [
                  {
                    traitId: trait.id,
                    score0to5: 4.4,
                    confidence: 0.8,
                    evidence: ["Leadership-focused response"]
                  }
                ]
              })
            }
          }
        ]
      })
    });
    process.env.OPENAI_API_KEY = "test-key";
    (global.fetch as unknown) = fetchMock as typeof fetch;

    const statusResponse = await request(app).post(`/api/phone/twilio/status?callSessionId=${callSessionId}`).type("form").send({
      CallSid: twilioSid,
      CallStatus: "completed"
    });

    expect(statusResponse.status).toBe(200);

    const updatedSession = await prisma.candidateSession.findUnique({ where: { id: candidateSessionId } });
    expect(updatedSession?.status).toBe("completed");

    const scorecards = await prisma.scorecard.findMany({ where: { sessionId: candidateSessionId } });
    expect(scorecards.length).toBeGreaterThan(0);

    global.fetch = originalFetch;
  });
});
