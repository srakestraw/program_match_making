import { log } from "./logger.js";

const counters = {
  "sessions.created": 0,
  "sessions.completed": 0,
  "sessions.failed": 0,
  "scoring.success": 0,
  "scoring.failed": 0,
  "realtime.token.success": 0,
  "realtime.token.failed": 0
} as const;

type CounterName = keyof typeof counters;

const values: Record<CounterName, number> = { ...counters };

export const incrementMetric = (name: CounterName, amount = 1) => {
  values[name] = (values[name] ?? 0) + amount;
  log("info", "metric.increment", { metric: name, value: values[name] });
};

export const getMetricsSnapshot = () => ({ ...values });
