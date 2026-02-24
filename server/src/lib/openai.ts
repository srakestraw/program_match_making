import { log } from "./logger.js";

const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 12000);
const maxRetries = Number(process.env.OPENAI_MAX_RETRIES ?? 1);

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchOpenAiWithRetry = async (url: string, options: FetchOptions) => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.status >= 500 && attempt < maxRetries) {
        await sleep(200 * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (attempt >= maxRetries) {
        throw error;
      }

      await sleep(200 * (attempt + 1));
    }
  }

  log("error", "openai.fetch.unreachable", { error: String(lastError) });
  throw new Error("OpenAI request failed");
};
