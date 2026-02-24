export type LogLevel = "debug" | "info" | "warn" | "error";

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const minLevel = ((process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel);
const minRank = levelRank[minLevel] ?? levelRank.info;

const sensitiveKey = /email|phone/i;
const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex = /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?){2}\d{4}\b/g;

const maskString = (value: string) => value.replace(emailRegex, "[REDACTED_EMAIL]").replace(phoneRegex, "[REDACTED_PHONE]");

const sanitize = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return maskString(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = sensitiveKey.test(key) ? "[REDACTED]" : sanitize(nested);
    }
    return output;
  }
  return value;
};

export const log = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
  if (levelRank[level] < minRank) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? { context: sanitize(context) } : {})
  };

  const line = JSON.stringify(payload);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
};
