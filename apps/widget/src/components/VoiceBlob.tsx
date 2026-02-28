type VoiceBlobState = "idle" | "listening" | "speaking" | "thinking";

const stateClass: Record<VoiceBlobState, string> = {
  idle: "voice-blob-idle",
  listening: "voice-blob-listening",
  speaking: "voice-blob-speaking",
  thinking: "voice-blob-thinking"
};

export const VoiceBlob = ({ state }: { state: VoiceBlobState }) => (
  <div className="voice-blob-wrap" aria-label={`Voice state: ${state}`}>
    <div className={`voice-blob ${stateClass[state]}`} />
  </div>
);
