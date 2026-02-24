import { prisma } from "../lib/prisma.js";
import { log } from "../lib/logger.js";

export type BridgeStartPayload = {
  streamSid: string;
};

export class TelephonyRealtimeBridge {
  readonly callSessionId: string;
  readonly candidateSessionId: string;
  readonly programId: string | null;

  private mediaChunkCounter = 0;
  private stopped = false;

  constructor(params: { callSessionId: string; candidateSessionId: string; programId: string | null }) {
    this.callSessionId = params.callSessionId;
    this.candidateSessionId = params.candidateSessionId;
    this.programId = params.programId;
  }

  async onStart(payload: BridgeStartPayload) {
    await prisma.callSession.update({
      where: { id: this.callSessionId },
      data: {
        streamSid: payload.streamSid,
        status: "IN_PROGRESS",
        startedAt: new Date()
      }
    });

    await this.persistTurn("assistant", "Phone interview started. Please introduce yourself.");
  }

  async onMedia(_base64Payload: string) {
    this.mediaChunkCounter += 1;

    // Twilio media streams provide audio chunks. For v1 pilot we persist periodic markers
    // while keeping adapter boundaries ready for full realtime audio bridging.
    if (this.mediaChunkCounter % 40 === 0) {
      await this.persistTurn("candidate", "[phone audio segment captured]");
    }
  }

  async onStop() {
    if (this.stopped) return;
    this.stopped = true;

    await this.persistTurn("assistant", "Phone interview ended.");
  }

  private async persistTurn(speaker: "candidate" | "assistant", text: string) {
    try {
      await prisma.transcriptTurn.create({
        data: {
          sessionId: this.candidateSessionId,
          ts: new Date(),
          speaker,
          text
        }
      });
    } catch (error) {
      log("error", "phone.transcript.persist_failed", {
        callSessionId: this.callSessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
