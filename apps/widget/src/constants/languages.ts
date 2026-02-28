export type LanguageOption = {
  tag: string;
  label: string;
};

export const PRIMARY_LANGUAGE_OPTIONS: LanguageOption[] = [
  { tag: "en", label: "English" },
  { tag: "es", label: "Spanish" },
  { tag: "fr", label: "French" },
  { tag: "zh", label: "Chinese" },
  { tag: "ar", label: "Arabic" }
];

export const EXTRA_LANGUAGE_OPTIONS: LanguageOption[] = [
  { tag: "pt-BR", label: "Portuguese (Brazil)" },
  { tag: "pt-PT", label: "Portuguese (Portugal)" },
  { tag: "de", label: "German" },
  { tag: "it", label: "Italian" },
  { tag: "hi", label: "Hindi" },
  { tag: "ja", label: "Japanese" },
  { tag: "ko", label: "Korean" },
  { tag: "ru", label: "Russian" },
  { tag: "tr", label: "Turkish" },
  { tag: "nl", label: "Dutch" },
  { tag: "pl", label: "Polish" },
  { tag: "he", label: "Hebrew" },
  { tag: "vi", label: "Vietnamese" },
  { tag: "th", label: "Thai" },
  { tag: "id", label: "Indonesian" },
  { tag: "fa", label: "Persian" },
  { tag: "ur", label: "Urdu" },
  { tag: "bn", label: "Bengali" }
];

export const ALL_LANGUAGE_OPTIONS: LanguageOption[] = [...PRIMARY_LANGUAGE_OPTIONS, ...EXTRA_LANGUAGE_OPTIONS];

export const languageLabelFromTag = (tag: string) =>
  ALL_LANGUAGE_OPTIONS.find((option) => option.tag.toLowerCase() === tag.toLowerCase())?.label ?? tag;
