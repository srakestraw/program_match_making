import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// DATABASE_URL from .env (RDS PostgreSQL)

let prisma: typeof import("../src/lib/prisma.js")["prisma"];
let TelephonyRealtimeBridge: typeof import("../src/phone/TelephonyRealtimeBridge.js")["TelephonyRealtimeBridge"];

describe("TelephonyRealtimeBridge", () => {
  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ TelephonyRealtimeBridge } = await import("../src/phone/TelephonyRealtimeBridge.js"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists transcript turns from stream lifecycle", async () => {
    const session = await prisma.candidateSession.create({
      data: {
        mode: "voice",
        channel: "PHONE_VOICE",
        status: "active"
      }
    });

    const callSession = await prisma.callSession.create({
      data: {
        candidateSessionId: session.id,
        toPhone: "+15551234567",
        fromPhone: "+15557654321",
        status: "INITIATED"
      }
    });

    const bridge = new TelephonyRealtimeBridge({
      callSessionId: callSession.id,
      candidateSessionId: session.id,
      programId: null
    });

    await bridge.onStart({ streamSid: "stream-123" });
    for (let i = 0; i < 40; i += 1) {
      await bridge.onMedia("dGVzdA==");
    }
    await bridge.onStop();

    const turns = await prisma.transcriptTurn.findMany({ where: { sessionId: session.id } });
    expect(turns.length).toBeGreaterThanOrEqual(3);
  });
});
