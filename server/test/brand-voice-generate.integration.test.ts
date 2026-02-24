import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const findUniqueMock = vi.fn();

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    brandVoice: {
      findUnique: findUniqueMock
    }
  }
}));

const generateBrandVoiceSamplesMock = vi.fn();
const synthesizeVoiceSampleMock = vi.fn();

vi.mock("../src/lib/brandVoiceSamples.js", () => ({
  generateBrandVoiceSamples: generateBrandVoiceSamplesMock
}));

vi.mock("../src/lib/simulationVoice.js", () => ({
  synthesizeVoiceSample: synthesizeVoiceSampleMock
}));

describe("POST /api/admin/brand-voices/:id/generate-samples", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    generateBrandVoiceSamplesMock.mockReset();
    synthesizeVoiceSampleMock.mockReset();
  });

  it("returns generated sample shape", async () => {
    findUniqueMock.mockResolvedValue({
      id: "voice-1",
      name: "Enrollment Voice",
      primaryTone: "professional",
      toneModifiers: ["encouraging"],
      toneProfile: {
        formality: 75,
        warmth: 60,
        directness: 65,
        confidence: 70,
        energy: 55
      },
      styleFlags: ["clear", "credible"],
      avoidFlags: ["jargon_heavy"],
      canonicalExamples: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    generateBrandVoiceSamplesMock.mockResolvedValue({
      headline: "Advance with confidence",
      cta: "Apply now",
      email_intro: "You are ready for the next step.",
      description: "A clear and credible voice for enrollment."
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/brand-voices/voice-1/generate-samples").send({
      context: { useCase: "web" }
    });

    expect(response.status).toBe(200);
    expect(response.body.samples).toEqual({
      headline: "Advance with confidence",
      cta: "Apply now",
      email_intro: "You are ready for the next step.",
      description: "A clear and credible voice for enrollment."
    });
    expect(generateBrandVoiceSamplesMock).toHaveBeenCalledOnce();
  });

  it("tests a selected voice and returns audio payload", async () => {
    synthesizeVoiceSampleMock.mockResolvedValue({
      provider: "openai",
      audioUrl: "data:audio/mpeg;base64,ZmFrZQ=="
    });

    const { createApp } = await import("../src/app.js");
    const app = createApp();

    const response = await request(app).post("/api/admin/brand-voices/test-voice").send({
      voiceName: "alloy",
      text: "Hello from admissions."
    });

    expect(response.status).toBe(201);
    expect(response.body.data.provider).toBe("openai");
    expect(response.body.data.audioUrl).toBe("data:audio/mpeg;base64,ZmFrZQ==");
  });
});
