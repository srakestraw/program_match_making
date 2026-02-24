import type { Request, Response } from "express";
import { ZodError } from "zod";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const statusToCode = (status: number) => {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "REQUEST_ERROR";
};

export const sendError = (res: Response, status: number, message: string, details?: unknown, code?: string) =>
  res.status(status).json({
    error: {
      code: code ?? statusToCode(status),
      message,
      ...(details !== undefined ? { details } : {})
    }
  } satisfies ApiErrorBody);

export const sendValidationError = (res: Response, error: ZodError) =>
  sendError(
    res,
    422,
    "Request validation failed",
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  );

export const getRequestId = (req: Request) => {
  const value = req.header("x-request-id") ?? req.header("X-Request-Id");
  return typeof value === "string" && value.length > 0 ? value : "unknown";
};
