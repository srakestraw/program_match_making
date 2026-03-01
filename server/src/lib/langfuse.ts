import { Langfuse, type LangfuseSpanClient } from "langfuse";
import { log } from "./logger.js";

let client: Langfuse | null = null;

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

const parseNumber = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isConfigured = () => {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  return Boolean(publicKey && secretKey);
};

export const isLangfuseEnabled = () => parseBoolean(process.env.LANGFUSE_ENABLED, true) && isConfigured();

const getClient = () => {
  if (!isLangfuseEnabled()) return null;
  if (client) return client;

  client = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL?.trim() || process.env.LANGFUSE_HOST?.trim() || undefined,
    sampleRate: parseNumber(process.env.LANGFUSE_SAMPLE_RATE),
    enabled: true
  });

  return client;
};

export const createLangfuseTrace = (input: {
  traceId: string;
  name: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}) => {
  try {
    const langfuse = getClient();
    if (!langfuse) return;
    langfuse.trace({
      id: input.traceId,
      name: input.name,
      sessionId: input.sessionId ?? input.traceId,
      metadata: input.metadata
    });
  } catch (error) {
    log("warn", "langfuse.trace_failed", {
      message: error instanceof Error ? error.message : "Unknown Langfuse trace error"
    });
  }
};

export const startLangfuseSpan = (input: {
  traceId: string;
  name: string;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) => {
  try {
    const langfuse = getClient();
    if (!langfuse) return null;
    return langfuse.span({
      traceId: input.traceId,
      name: input.name,
      input: input.input,
      metadata: input.metadata
    });
  } catch (error) {
    log("warn", "langfuse.span_start_failed", {
      message: error instanceof Error ? error.message : "Unknown Langfuse span error"
    });
    return null;
  }
};

export const endLangfuseSpan = (
  span: LangfuseSpanClient | null,
  input?: {
    output?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
    statusMessage?: string;
  }
) => {
  if (!span) return;
  try {
    span.end({
      output: input?.output,
      metadata: input?.metadata,
      level: input?.level,
      statusMessage: input?.statusMessage
    });
  } catch (error) {
    log("warn", "langfuse.span_end_failed", {
      message: error instanceof Error ? error.message : "Unknown Langfuse span end error"
    });
  }
};

export const shutdownLangfuse = async () => {
  const langfuse = getClient();
  if (!langfuse) return;
  try {
    await langfuse.flushAsync();
    await langfuse.shutdownAsync();
  } catch (error) {
    log("warn", "langfuse.shutdown_failed", {
      message: error instanceof Error ? error.message : "Unknown Langfuse shutdown error"
    });
  }
};
