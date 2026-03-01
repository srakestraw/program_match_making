export type VoicePhase =
  | "init"
  | "permissions"
  | "connecting"
  | "kickoff"
  | "speaking"
  | "listening"
  | "thinking"
  | "paused"
  | "ended"
  | "error";

export type VoiceInputMode = "handsfree" | "hold_to_talk";
export type VoiceBlobState = "idle" | "listening" | "speaking" | "thinking";

export type VoicePhaseEvent =
  | "request_permissions"
  | "permissions_granted"
  | "transport_connected"
  | "kickoff_ready"
  | "assistant_done"
  | "user_transcript_finalized"
  | "turn_response_ready"
  | "pause"
  | "resume"
  | "end"
  | "fail";

export const reduceVoicePhase = (phase: VoicePhase, event: VoicePhaseEvent): VoicePhase => {
  switch (event) {
    case "request_permissions":
      return "permissions";
    case "permissions_granted":
      return "connecting";
    case "transport_connected":
      return "kickoff";
    case "kickoff_ready":
      return "speaking";
    case "assistant_done":
      return "listening";
    case "user_transcript_finalized":
      return "thinking";
    case "turn_response_ready":
      return "speaking";
    case "pause":
      return "paused";
    case "resume":
      return "listening";
    case "end":
      return "ended";
    case "fail":
      return "error";
    default:
      return phase;
  }
};

export const toVoiceBlobState = (phase: VoicePhase): VoiceBlobState => {
  if (phase === "speaking") return "speaking";
  if (phase === "listening") return "listening";
  if (phase === "thinking" || phase === "kickoff" || phase === "connecting") return "thinking";
  return "idle";
};

export const isConnectedPhase = (phase: VoicePhase) => ["kickoff", "speaking", "listening", "thinking"].includes(phase);

export const getVoicePhaseLabel = (phase: VoicePhase) => {
  if (phase === "kickoff") return "Kickoff";
  if (phase === "init") return "Ready";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
};

export const shouldKickoff = (phase: VoicePhase, hasKickedOff: boolean) => phase === "kickoff" && !hasKickedOff;
