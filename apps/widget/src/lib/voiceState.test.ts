import { describe, expect, it } from "vitest";
import { reduceVoicePhase, shouldKickoff } from "./voiceState";

describe("voice kickoff", () => {
  it("calls kickoff exactly once from kickoff phase", () => {
    expect(shouldKickoff("kickoff", false)).toBe(true);
    expect(shouldKickoff("kickoff", true)).toBe(false);
  });
});

describe("voice phase transitions", () => {
  it("moves kickoff -> speaking -> listening", () => {
    const speaking = reduceVoicePhase("kickoff", "kickoff_ready");
    const listening = reduceVoicePhase(speaking, "assistant_done");
    expect(speaking).toBe("speaking");
    expect(listening).toBe("listening");
  });

  it("moves listening -> thinking -> speaking after user transcript and turn response", () => {
    const thinking = reduceVoicePhase("listening", "user_transcript_finalized");
    const speaking = reduceVoicePhase(thinking, "turn_response_ready");
    expect(thinking).toBe("thinking");
    expect(speaking).toBe("speaking");
  });
});
