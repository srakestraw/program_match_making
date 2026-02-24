export type SmsKeyword = "STOP" | "START" | null;

export const classifySmsKeyword = (body: string): SmsKeyword => {
  const normalized = body.trim().toUpperCase();
  if (!normalized) return null;

  if (["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(normalized)) {
    return "STOP";
  }

  if (normalized === "START") {
    return "START";
  }

  return null;
};

export type InboundProgressInput = {
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "OPTED_OUT";
  currentStep: number;
  totalQuestions: number;
  inboundBody: string;
};

export type InboundProgressAction =
  | { kind: "opt_out" }
  | { kind: "opt_in" }
  | { kind: "ignored_opted_out" }
  | { kind: "complete"; nextStep: number }
  | { kind: "ask_next"; questionIndex: number; nextStep: number };

export const getInboundProgressAction = (input: InboundProgressInput): InboundProgressAction => {
  const keyword = classifySmsKeyword(input.inboundBody);

  if (keyword === "STOP") {
    return { kind: "opt_out" };
  }

  if (keyword === "START" && input.status === "OPTED_OUT") {
    return { kind: "opt_in" };
  }

  if (input.status === "OPTED_OUT") {
    return { kind: "ignored_opted_out" };
  }

  if (input.totalQuestions <= 0) {
    return { kind: "complete", nextStep: 0 };
  }

  const nextStep = input.currentStep + 1;
  if (nextStep >= input.totalQuestions) {
    return { kind: "complete", nextStep: input.totalQuestions };
  }

  return {
    kind: "ask_next",
    questionIndex: nextStep,
    nextStep
  };
};
