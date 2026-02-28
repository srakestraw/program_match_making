const LANGUAGE_TO_LOCALE: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  zh: "zh-CN",
  ar: "ar-SA"
};

export const localeForLanguageTag = (tag: string) => {
  const lower = tag.toLowerCase();
  if (LANGUAGE_TO_LOCALE[lower]) return LANGUAGE_TO_LOCALE[lower];
  if (lower.includes("-")) return tag;
  return `${tag}-${tag.toUpperCase()}`;
};

export const pickVoiceForLanguage = (voices: SpeechSynthesisVoice[], languageTag: string) => {
  const prefix = languageTag.toLowerCase().split("-")[0];
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
};

export const createLanguageUtterance = (text: string, languageTag: string, voices: SpeechSynthesisVoice[] = []) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = localeForLanguageTag(languageTag);
  const selected = pickVoiceForLanguage(voices, languageTag);
  if (selected) {
    utterance.voice = selected;
    utterance.lang = selected.lang || utterance.lang;
  }
  return utterance;
};
