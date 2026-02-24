import { CallStatus } from "@prisma/client";

export const mapTwilioStatusToCallStatus = (event: string): CallStatus => {
  const normalized = event.toLowerCase();
  if (normalized === "queued" || normalized === "initiated") return "INITIATED";
  if (normalized === "ringing") return "RINGING";
  if (normalized === "in-progress") return "IN_PROGRESS";
  if (normalized === "completed") return "COMPLETED";
  if (normalized === "busy") return "BUSY";
  if (normalized === "no-answer") return "NO_ANSWER";
  if (normalized === "canceled") return "CANCELED";
  if (normalized === "failed") return "FAILED";
  return "FAILED";
};
