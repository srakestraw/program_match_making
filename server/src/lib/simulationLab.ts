import { ConversationPersona } from "@prisma/client";
import { normalizeToneProfile } from "./brandVoice.js";

export const pressureTestPrompts = [
  "I am not convinced this program is worth the cost.",
  "This sounds too hard for someone with my background.",
  "I worry this will not lead to better job outcomes.",
  "Your message feels generic. Why should I trust this advice?",
  "I need a clear next step today or I will move on."
] as const;

const personaLabelMap: Record<ConversationPersona, string> = {
  STUDENT: "student",
  PARENT: "parent",
  INTERNATIONAL: "international applicant"
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const composeAssistantReply = (input: {
  brandVoice: {
    name: string;
    primaryTone: string;
    toneModifiers: string[];
    toneProfile: unknown;
    styleFlags: string[];
    avoidFlags: string[];
  };
  persona: ConversationPersona;
  scenarioTitle?: string;
  scenarioContext?: string;
  latestUserMessage: string;
}) => {
  const tone = normalizeToneProfile(input.brandVoice.toneProfile);
  const modifierLabel = input.brandVoice.toneModifiers.slice(0, 2).join(", ") || "clear";
  const greeting = tone.warmth >= 65 ? `I hear your concern as a ${personaLabelMap[input.persona]}.` : "Thanks for the question.";
  const direction =
    tone.directness >= 70
      ? "Here is the direct answer"
      : tone.formality >= 70
      ? "A concise way to think about it"
      : "One practical way to approach this";
  const energyLine = tone.energy >= 65 ? "You have a strong path forward." : "You can move step-by-step with confidence.";
  const confidenceLine = tone.confidence >= 70 ? "I can outline the next action now." : "I can suggest a realistic next action.";
  const scenarioLine = input.scenarioTitle ? `Scenario: ${input.scenarioTitle}.` : "";
  const contextLine = input.scenarioContext ? `Context: ${input.scenarioContext}.` : "";

  return [
    greeting,
    `${direction}: ${input.latestUserMessage.trim().replace(/\s+/g, " ")}`,
    `Using ${titleCase(input.brandVoice.primaryTone)} tone (${modifierLabel}), we focus on ${
      input.brandVoice.styleFlags.slice(0, 2).join(" and ") || "clarity"
    } while avoiding ${input.brandVoice.avoidFlags.slice(0, 2).join(" and ") || "overstatement"}.`,
    scenarioLine,
    contextLine,
    energyLine,
    confidenceLine
  ]
    .filter(Boolean)
    .join(" ");
};

export const findAvoidHits = (text: string, avoidFlags: string[]) => {
  const hits: Array<{ token: string; index: number; length: number }> = [];
  const lower = text.toLowerCase();

  for (const token of avoidFlags) {
    const raw = token.trim().toLowerCase();
    if (!raw) continue;

    const variants = [...new Set([raw, raw.replaceAll("_", " "), raw.replaceAll("_", "-")])];
    for (const variant of variants) {
      let start = 0;
      while (start < lower.length) {
        const idx = lower.indexOf(variant, start);
        if (idx === -1) break;
        hits.push({ token: raw, index: idx, length: variant.length });
        start = idx + variant.length;
      }
    }
  }

  return hits.sort((a, b) => a.index - b.index);
};

export const calculateStabilityScore = (text: string, avoidHitCount: number) => {
  let score = 100;
  score -= avoidHitCount * 10;
  if (text.length > 1200) score -= 5;
  const lower = text.toLowerCase();
  if (lower.includes("guarantee") || lower.includes("promise")) score -= 5;
  return Math.max(0, score);
};
