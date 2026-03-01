import { fetchOpenAiWithRetry } from "./openai.js";

export type GenerateTraitSignalsInput = {
  name: string;
  definition: string | null;
  category: string;
};

export type GenerateTraitSignalsOutput = {
  positiveSignals: string[];
  negativeSignals: string[];
  followUps: string[];
};

export type GenerateTraitQuestionsInput = {
  name: string;
  definition: string | null;
  category: string;
};

export type GenerateTraitQuestionsOutput = {
  chatPrompt: string;
  quizPrompt: string;
  quizOptions: string[];
};

export type GenerateTraitExperienceDraftInput = {
  action: "generate" | "gen_z" | "simplify" | "aspirational";
  name: string;
  definition: string | null;
  category: string;
};

export type GenerateTraitExperienceDraftOutput = {
  publicLabel: string;
  oneLineHook: string;
  archetypeTag: "ANALYST" | "BUILDER" | "STRATEGIST" | "OPERATOR" | "VISIONARY" | "LEADER" | "COMMUNICATOR";
  displayIcon: string;
  visualMood: "NEUTRAL" | "ASPIRATIONAL" | "PLAYFUL" | "BOLD" | "SERIOUS";
};

const model = () => process.env.OPENAI_TRAIT_MODEL ?? process.env.OPENAI_BRAND_VOICE_MODEL ?? "gpt-4.1-mini";

function ensureApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return apiKey;
}

function ensureArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => String(s).trim())
    .filter(Boolean);
}

function ensureString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function extractResponsesJsonText(payload: unknown): string {
  const topLevel = payload as { output_text?: unknown };
  if (typeof topLevel.output_text === "string" && topLevel.output_text.trim()) {
    return topLevel.output_text.trim();
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        return text.trim();
      }
    }
  }

  return "";
}

export async function generateTraitSignals(input: GenerateTraitSignalsInput): Promise<GenerateTraitSignalsOutput> {
  const apiKey = ensureApiKey();
  const categoryLabel = input.category.replace(/_/g, " ").toLowerCase();
  const definitionPart = input.definition?.trim()
    ? `Definition: ${input.definition.trim()}\n\n`
    : "";

  const systemPrompt = `You are an expert in graduate program admissions evaluation. Produce rubric content for scoring candidate responses.

Return strict JSON with these keys only:
- positiveSignals: array of 3-5 short phrases (each under 15 words) that indicate STRONG evidence for this trait in a candidate's response.
- negativeSignals: array of 3-5 short phrases that indicate WEAK or concerning evidence.
- followUps: array of 1-2 optional follow-up prompts an evaluator could ask to probe further.

Phrases should be specific enough to guide an LLM evaluator. No markdown, no code blocks.`;

  const userContent = `Trait name: ${input.name}
Category: ${categoryLabel}
${definitionPart}Return JSON: {"positiveSignals":["..."],"negativeSignals":["..."],"followUps":["..."]}`;

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model(),
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    })
  });

  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof (payload as { error?: { message?: string } })?.error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : "Failed to generate signals";
    throw new Error(`OPENAI_UPSTREAM: ${message}`);
  }

  const content = (payload as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Signal generation returned an invalid response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Signal generation JSON parse failed");
  }

  const obj = parsed as Record<string, unknown>;
  return {
    positiveSignals: ensureArray(obj?.positiveSignals, "positiveSignals"),
    negativeSignals: ensureArray(obj?.negativeSignals, "negativeSignals"),
    followUps: ensureArray(obj?.followUps, "followUps")
  };
}

export async function generateTraitQuestions(input: GenerateTraitQuestionsInput): Promise<GenerateTraitQuestionsOutput> {
  const apiKey = ensureApiKey();
  const categoryLabel = input.category.replace(/_/g, " ").toLowerCase();
  const definitionPart = input.definition?.trim()
    ? `Definition: ${input.definition.trim()}\n\n`
    : "";

  const systemPrompt = `You are an expert in graduate program admissions. Create interview questions to elicit evidence for a trait.

Return strict JSON with these keys only:
- chatPrompt: one open-ended question (1-2 sentences) for a voice or chat interview that asks the candidate to describe a specific example or situation demonstrating this trait.
- quizPrompt: one multiple-choice question stem (e.g. "Which response best demonstrates...") that fits the trait.
- quizOptions: array of exactly 4 short answer options (ordered from weakest to strongest, or as distinct choices). Each option should be a short sentence or phrase.

Questions should be appropriate for graduate admissions evaluation. No markdown, no code blocks.`;

  const userContent = `Trait name: ${input.name}
Category: ${categoryLabel}
${definitionPart}Return JSON: {"chatPrompt":"...","quizPrompt":"...","quizOptions":["...","...","...","..."]}`;

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model(),
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    })
  });

  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof (payload as { error?: { message?: string } })?.error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : "Failed to generate questions";
    throw new Error(`OPENAI_UPSTREAM: ${message}`);
  }

  const content = (payload as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Question generation returned an invalid response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Question generation JSON parse failed");
  }

  const obj = parsed as Record<string, unknown>;
  const options = ensureArray(obj?.quizOptions, "quizOptions");
  return {
    chatPrompt: ensureString(obj?.chatPrompt),
    quizPrompt: ensureString(obj?.quizPrompt),
    quizOptions: options.length >= 4 ? options.slice(0, 4) : options
  };
}

export async function generateTraitExperienceDraft(
  input: GenerateTraitExperienceDraftInput
): Promise<GenerateTraitExperienceDraftOutput> {
  const apiKey = ensureApiKey();
  const styleInstruction =
    input.action === "gen_z"
      ? "Use concise Gen Z-friendly language while staying admissions-safe."
      : input.action === "simplify"
      ? "Use plain language and short words."
      : input.action === "aspirational"
      ? "Use aspirational but credible language."
      : "Use professional but accessible language.";

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model(),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Create a public-facing trait experience draft for a quiz product. Return only JSON matching schema exactly."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Trait: ${input.name}\nCategory: ${input.category}\nDefinition: ${input.definition ?? ""}\nInstruction: ${styleInstruction}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "trait_experience_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              publicLabel: { type: "string", minLength: 2, maxLength: 120 },
              oneLineHook: { type: "string", minLength: 8, maxLength: 180 },
              archetypeTag: {
                type: "string",
                enum: ["ANALYST", "BUILDER", "STRATEGIST", "OPERATOR", "VISIONARY", "LEADER", "COMMUNICATOR"]
              },
              displayIcon: { type: "string", minLength: 2, maxLength: 80 },
              visualMood: { type: "string", enum: ["NEUTRAL", "ASPIRATIONAL", "PLAYFUL", "BOLD", "SERIOUS"] }
            },
            required: ["publicLabel", "oneLineHook", "archetypeTag", "displayIcon", "visualMood"]
          }
        }
      }
    })
  });

  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof (payload as { error?: { message?: string } })?.error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : "Failed to generate trait experience draft";
    throw new Error(`OPENAI_UPSTREAM: ${message}`);
  }

  const jsonText = extractResponsesJsonText(payload);

  if (!jsonText) {
    throw new Error("Experience draft generation returned an invalid response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Experience draft JSON parse failed");
  }

  const draft = parsed as Partial<GenerateTraitExperienceDraftOutput>;
  return {
    publicLabel: ensureString(draft.publicLabel).slice(0, 120),
    oneLineHook: ensureString(draft.oneLineHook).slice(0, 180),
    archetypeTag: (draft.archetypeTag as GenerateTraitExperienceDraftOutput["archetypeTag"]) ?? "ANALYST",
    displayIcon: ensureString(draft.displayIcon).slice(0, 80) || "spark",
    visualMood: (draft.visualMood as GenerateTraitExperienceDraftOutput["visualMood"]) ?? "NEUTRAL"
  };
}
