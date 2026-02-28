import { jsx as _jsx } from "react/jsx-runtime";
const stateClass = {
    idle: "voice-blob-idle",
    listening: "voice-blob-listening",
    speaking: "voice-blob-speaking",
    thinking: "voice-blob-thinking"
};
export const VoiceBlob = ({ state }) => (_jsx("div", { className: "voice-blob-wrap", "aria-label": `Voice state: ${state}`, children: _jsx("div", { className: `voice-blob ${stateClass[state]}` }) }));
