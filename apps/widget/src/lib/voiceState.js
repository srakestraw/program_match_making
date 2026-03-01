export const reduceVoicePhase = (phase, event) => {
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
export const toVoiceBlobState = (phase) => {
    if (phase === "speaking")
        return "speaking";
    if (phase === "listening")
        return "listening";
    if (phase === "thinking" || phase === "kickoff" || phase === "connecting")
        return "thinking";
    return "idle";
};
export const isConnectedPhase = (phase) => ["kickoff", "speaking", "listening", "thinking"].includes(phase);
export const getVoicePhaseLabel = (phase) => {
    if (phase === "kickoff")
        return "Kickoff";
    if (phase === "init")
        return "Ready";
    return phase.charAt(0).toUpperCase() + phase.slice(1);
};
export const shouldKickoff = (phase, hasKickedOff) => phase === "kickoff" && !hasKickedOff;
