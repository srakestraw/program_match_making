import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setSmsProviderForTests } from "../src/sms/TwilioSmsAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// DATABASE_URL from .env (RDS PostgreSQL)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let prisma: typeof import("../src/lib/prisma.js")["prisma"];
let createApp: typeof import("../src/app.js")["createApp"];

describe.sequential("sms integration", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    setSmsProviderForTests(null);
    await prisma.$disconnect();
  });

  it("runs SMS interview to completion and blocks follow-up on STOP opt-out", async () => {
    const suffix = Date.now().toString(36);
    const token = `sms-secret-${suffix}`;
    const phone = `+1555${Date.now().toString().slice(-7)}`;

    process.env.TWILIO_WEBHOOK_BASE_URL = "https://example.ngrok-free.app";
    process.env.TWILIO_WEBHOOK_AUTH_SECRET = token;
    process.env.TWILIO_FROM_NUMBER = "+15550009999";

    const trait = await prisma.trait.create({
      data: {
        name: `SMS Trait ${suffix}`,
        category: "MOTIVATION",
        rubricScaleMin: 0,
        rubricScaleMax: 5
      }
    });

    const program = await prisma.program.create({
      data: {
        name: `SMS Program ${suffix}`,
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

    await prisma.traitQuestion.createMany({
      data: [
        {
          traitId: trait.id,
          type: "CHAT",
          prompt: "Why do you want this program?"
        },
        {
          traitId: trait.id,
          type: "CHAT",
          prompt: "How do you handle setbacks?"
        }
      ]
    });

    const candidate = await prisma.candidate.create({
      data: {
        firstName: "SMS",
        lastName: "Candidate",
        phone
      }
    });

    const lead = await prisma.lead.create({
      data: {
        candidateId: candidate.id,
        programId: program.id,
        status: "NEW"
      }
    });

    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ sid: `SM_start_${suffix}`, status: "sent" })
      .mockResolvedValueOnce({ sid: `SM_next_${suffix}`, status: "sent" })
      .mockResolvedValueOnce({ sid: `SM_done_${suffix}`, status: "sent" });

    setSmsProviderForTests({ sendMessage });

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
                    score0to5: 4.1,
                    confidence: 0.79,
                    evidence: ["Clear motivation and resilience"]
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

    const app = createApp();

    const startResponse = await request(app).post("/api/sms/start").send({ leadId: lead.id, programId: program.id });
    expect(startResponse.status).toBe(201);

    const smsSession = await prisma.smsSession.findUnique({ where: { id: startResponse.body.smsSessionId } });
    expect(smsSession).toBeTruthy();
    await sleep(2100);

    const firstInbound = await request(app)
      .post(`/api/sms/twilio/inbound?token=${encodeURIComponent(token)}`)
      .type("form")
      .send({
        From: phone,
        To: "+15550009999",
        Body: "I want to grow my career",
        MessageSid: `SM_IN_1_${suffix}`
      });
    expect(firstInbound.status).toBe(200);
    await sleep(2100);

    const secondInbound = await request(app)
      .post(`/api/sms/twilio/inbound?token=${encodeURIComponent(token)}`)
      .type("form")
      .send({
        From: phone,
        To: "+15550009999",
        Body: "I adapt and keep improving",
        MessageSid: `SM_IN_2_${suffix}`
      });
    expect(secondInbound.status).toBe(200);

    const completedSession = await prisma.candidateSession.findUnique({ where: { id: smsSession!.candidateSessionId } });
    expect(completedSession?.status).toBe("completed");

    const scorecards = await prisma.scorecard.findMany({ where: { sessionId: smsSession!.candidateSessionId } });
    expect(scorecards.length).toBeGreaterThan(0);

    const stopResponse = await request(app)
      .post(`/api/sms/twilio/inbound?token=${encodeURIComponent(token)}`)
      .type("form")
      .send({
        From: phone,
        To: "+15550009999",
        Body: "STOP",
        MessageSid: `SM_IN_STOP_${suffix}`
      });

    expect(stopResponse.status).toBe(200);

    const sendAfterStop = await request(app).post("/api/sms/send").send({
      leadId: lead.id,
      body: "Checking in from admissions"
    });

    expect(sendAfterStop.status).toBe(409);
    expect(sendAfterStop.body.error.code).toBe("SMS_OPTED_OUT");

    const inboundMessages = await prisma.smsMessage.findMany({
      where: { smsSessionId: smsSession!.id, direction: "INBOUND" }
    });
    expect(inboundMessages.length).toBeGreaterThanOrEqual(3);

    global.fetch = originalFetch;
  }, 15_000);

  it("creates an SMS session from inbound webhook when none exists", async () => {
    const suffix = `${Date.now().toString(36)}-inbound`;
    const token = `sms-secret-${suffix}`;
    const phone = `+1555${(Date.now() + 11).toString().slice(-7)}`;

    process.env.TWILIO_WEBHOOK_BASE_URL = "https://example.ngrok-free.app";
    process.env.TWILIO_WEBHOOK_AUTH_SECRET = token;
    process.env.TWILIO_FROM_NUMBER = "+15550009999";

    const trait = await prisma.trait.create({
      data: {
        name: `Inbound SMS Trait ${suffix}`,
        category: "MOTIVATION",
        rubricScaleMin: 0,
        rubricScaleMax: 5
      }
    });

    const program = await prisma.program.create({
      data: {
        name: `Inbound SMS Program ${suffix}`,
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

    await prisma.traitQuestion.createMany({
      data: [
        {
          traitId: trait.id,
          type: "CHAT",
          prompt: "What motivates you most?"
        },
        {
          traitId: trait.id,
          type: "CHAT",
          prompt: "How will you contribute?"
        }
      ]
    });

    const candidate = await prisma.candidate.create({
      data: {
        firstName: "Inbound",
        phone
      }
    });

    const lead = await prisma.lead.create({
      data: {
        candidateId: candidate.id,
        programId: program.id,
        status: "NEW"
      }
    });

    setSmsProviderForTests({
      sendMessage: vi.fn().mockResolvedValue({ sid: `SM_inbound_start_${suffix}`, status: "sent" })
    });

    const app = createApp();

    const inbound = await request(app)
      .post(`/api/sms/twilio/inbound?token=${encodeURIComponent(token)}`)
      .type("form")
      .send({
        From: phone,
        To: "+15550009999",
        Body: "Hi there",
        MessageSid: `SM_IN_FIRST_${suffix}`
      });

    expect(inbound.status).toBe(200);

    const smsSession = await prisma.smsSession.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" }
    });
    expect(smsSession).toBeTruthy();

    const messages = await prisma.smsMessage.findMany({ where: { smsSessionId: smsSession!.id } });
    expect(messages.some((message) => message.direction === "INBOUND")).toBe(true);
    expect(messages.some((message) => message.direction === "OUTBOUND")).toBe(true);
  });
});
