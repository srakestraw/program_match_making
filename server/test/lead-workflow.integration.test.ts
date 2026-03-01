import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// DATABASE_URL from .env (RDS PostgreSQL)

let prisma: typeof import("../src/lib/prisma.js")["prisma"];
let createApp: typeof import("../src/app.js")["createApp"];

describe("lead capture and advisor workflow integration", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ createApp } = await import("../src/app.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("captures a lead, lists it, and updates workflow fields", async () => {
    const suffix = Date.now().toString(36);

    const trait = await prisma.trait.create({
      data: {
        name: `Lead Trait ${suffix}`,
        category: "MOTIVATION",
        rubricScaleMin: 0,
        rubricScaleMax: 5
      }
    });

    const program = await prisma.program.create({
      data: {
        name: `Lead Program ${suffix}`,
        isActive: true
      }
    });

    const session = await prisma.candidateSession.create({
      data: {
        mode: "quiz",
        status: "completed",
        programId: program.id,
        endedAt: new Date()
      }
    });

    await prisma.scorecard.create({
      data: {
        sessionId: session.id,
        programId: program.id,
        overallScore: 4.2,
        traitScores: {
          create: [
            {
              traitId: trait.id,
              bucket: "CRITICAL",
              score0to5: 4.2,
              confidence: 0.82,
              evidenceJson: JSON.stringify(["Strong motivation statements"]) 
            }
          ]
        }
      }
    });

    const app = createApp();

    const captureResponse = await request(app).post("/api/public/leads").send({
      firstName: "Taylor",
      lastName: "Student",
      email: `lead-${suffix}@example.edu`,
      phone: "555-0101",
      preferredChannel: "email",
      programId: program.id,
      sessionId: session.id
    });

    expect(captureResponse.status).toBe(201);
    expect(captureResponse.body.leadId).toBeTruthy();

    const sessionAfter = await prisma.candidateSession.findUnique({ where: { id: session.id } });
    expect(sessionAfter?.candidateId).toBe(captureResponse.body.candidateId);

    const listResponse = await request(app).get(`/api/advisor/leads?programId=${program.id}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.length).toBeGreaterThan(0);

    const listed = listResponse.body.data.find((item: any) => item.id === captureResponse.body.leadId);
    expect(listed).toBeTruthy();
    expect(listed.scoreSummary.overallScore).toBe(4.2);

    const updateResponse = await request(app).put(`/api/advisor/leads/${captureResponse.body.leadId}`).send({
      status: "CONTACTED",
      notes: "Candidate requested evening call window."
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.status).toBe("CONTACTED");

    const savedLead = await prisma.lead.findUnique({ where: { id: captureResponse.body.leadId } });
    expect(savedLead?.status).toBe("CONTACTED");
    expect(savedLead?.notes).toContain("evening");
  });
});
