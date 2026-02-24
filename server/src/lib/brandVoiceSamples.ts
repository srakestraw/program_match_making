import { fetchOpenAiWithRetry } from "./openai.js";

export type GeneratedSamples = {
  headline: string;
  cta: string;
  email_intro: string;
  description: string;
};

const responseSchema = {
  headline: "",
  cta: "",
  email_intro: "",
  description: ""
};

export const generateBrandVoiceSamples = async (prompt: string): Promise<GeneratedSamples> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_BRAND_VOICE_MODEL ?? "gpt-4.1-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You produce concise brand voice copy. Return strict JSON with keys headline, cta, email_intro, description. No markdown."
        },
        {
          role: "user",
          content: `${prompt}\n\nReturn JSON: ${JSON.stringify(responseSchema)}`
        }
      ]
    })
  });

  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "Failed to generate samples";
    throw new Error(`OPENAI_UPSTREAM: ${message}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Sample generation returned an invalid response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Sample generation JSON parse failed");
  }

  return {
    headline: String(parsed?.headline ?? "").trim(),
    cta: String(parsed?.cta ?? "").trim(),
    email_intro: String(parsed?.email_intro ?? "").trim(),
    description: String(parsed?.description ?? "").trim()
  };
};
