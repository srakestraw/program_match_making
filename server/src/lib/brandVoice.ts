import { z } from "zod";

const toneValues = ["friendly", "encouraging", "direct", "professional", "playful"] as const;
const sampleTypes = ["headline", "cta", "email_intro", "description"] as const;

export const brandVoiceDefaults = {
  primaryTone: "professional" as const,
  ttsVoiceName: "alloy",
  toneModifiers: ["encouraging"],
  toneProfile: {
    formality: 75,
    warmth: 60,
    directness: 65,
    confidence: 70,
    energy: 55
  },
  styleFlags: ["clear", "credible", "supportive", "future_focused"],
  avoidFlags: ["jargon_heavy", "overly_salesy", "impersonal"]
};

export const toneProfileSchema = z.object({
  formality: z.number().int().min(0).max(100),
  warmth: z.number().int().min(0).max(100),
  directness: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  energy: z.number().int().min(0).max(100)
});

export const canonicalExampleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(sampleTypes),
  text: z.string().trim().min(1).max(400),
  pinned: z.boolean().default(true)
});

export const createBrandVoiceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  primaryTone: z.enum(toneValues).optional(),
  ttsVoiceName: z.string().trim().min(1).max(80).optional(),
  toneModifiers: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  toneProfile: toneProfileSchema.optional(),
  styleFlags: z.array(z.string().trim().min(1).max(50)).max(24).optional(),
  avoidFlags: z.array(z.string().trim().min(1).max(50)).max(24).optional(),
  canonicalExamples: z.array(canonicalExampleSchema).max(40).optional()
});

export const updateBrandVoiceSchema = createBrandVoiceSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

export const generateSamplesSchema = z.object({
  context: z
    .object({
      brandName: z.string().trim().max(120).optional(),
      audience: z.string().trim().max(200).optional(),
      useCase: z.enum(["web", "email", "sms", "general"]).optional()
    })
    .optional()
    .default({})
});

export type CanonicalExample = z.infer<typeof canonicalExampleSchema>;

export const normalizeCanonicalExamples = (value: unknown): CanonicalExample[] => {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map((item) => canonicalExampleSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data);

  return parsed;
};

export const normalizeToneProfile = (value: unknown) => {
  const parsed = toneProfileSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return { ...brandVoiceDefaults.toneProfile };
};

export const buildBrandVoicePrompt = (input: {
  name: string;
  primaryTone: string;
  toneModifiers: string[];
  toneProfile: { formality: number; warmth: number; directness: number; confidence: number; energy: number };
  styleFlags: string[];
  avoidFlags: string[];
  canonicalExamples: CanonicalExample[];
  context: { brandName?: string; audience?: string; useCase?: "web" | "email" | "sms" | "general" };
}) => {
  const exampleLines = input.canonicalExamples.slice(0, 10).map((example) => `- ${example.type}: ${example.text}`);

  return [
    `Brand Voice Name: ${input.name}`,
    `Primary tone: ${input.primaryTone}`,
    `Tone modifiers: ${input.toneModifiers.join(", ") || "none"}`,
    `Tone profile (0-100): formality=${input.toneProfile.formality}, warmth=${input.toneProfile.warmth}, directness=${input.toneProfile.directness}, confidence=${input.toneProfile.confidence}, energy=${input.toneProfile.energy}`,
    `Voice behaviors: ${input.styleFlags.join(", ") || "none"}`,
    `Avoid: ${input.avoidFlags.join(", ") || "none"}`,
    `Context brandName: ${input.context.brandName || "none"}`,
    `Context audience: ${input.context.audience || "none"}`,
    `Context useCase: ${input.context.useCase || "general"}`,
    `Canonical examples:\n${exampleLines.length > 0 ? exampleLines.join("\n") : "- none"}`
  ].join("\n");
};
