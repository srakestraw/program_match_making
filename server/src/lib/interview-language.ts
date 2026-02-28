export const DEFAULT_INTERVIEW_LANGUAGE = "en";

export const ENGLISH_ONLY_GUARDRAIL = "Always respond in English. Do not switch languages unless the user explicitly asks.";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  zh: "Chinese",
  ar: "Arabic"
};

export const languageLabelForTag = (tag: string) => LANGUAGE_LABELS[tag.toLowerCase()] ?? tag;

export const languageGuardrailForTag = (tag: string) => {
  const normalized = tag.toLowerCase();
  if (normalized === "en") {
    return ENGLISH_ONLY_GUARDRAIL;
  }
  return `Respond in ${languageLabelForTag(tag)} only. Do not switch languages unless the user explicitly asks.`;
};

export const buildInterviewSystemPrompt = (input: {
  brandVoicePrompt?: string | null;
  language?: string | null;
}) => {
  const language = (input.language ?? DEFAULT_INTERVIEW_LANGUAGE).trim().toLowerCase();
  const basePrompt =
    input.brandVoicePrompt?.trim() ||
    "You are a warm, concise admissions interviewer. Ask one question at a time and keep guidance practical.";
  return `${basePrompt}\n\n${languageGuardrailForTag(language)}`;
};
