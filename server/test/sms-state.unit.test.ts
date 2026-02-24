import { describe, expect, it } from "vitest";
import { classifySmsKeyword, getInboundProgressAction } from "../src/sms/state.js";

describe("sms state machine", () => {
  it("classifies STOP and START keywords", () => {
    expect(classifySmsKeyword("stop")).toBe("STOP");
    expect(classifySmsKeyword("UNSUBSCRIBE")).toBe("STOP");
    expect(classifySmsKeyword("START")).toBe("START");
    expect(classifySmsKeyword("hello")).toBeNull();
  });

  it("advances question steps and completes at last response", () => {
    const first = getInboundProgressAction({
      status: "ACTIVE",
      currentStep: 0,
      totalQuestions: 3,
      inboundBody: "answer 1"
    });
    expect(first).toEqual({ kind: "ask_next", questionIndex: 1, nextStep: 1 });

    const completion = getInboundProgressAction({
      status: "ACTIVE",
      currentStep: 2,
      totalQuestions: 3,
      inboundBody: "final answer"
    });
    expect(completion).toEqual({ kind: "complete", nextStep: 3 });
  });

  it("handles opt-out and opt-in behavior", () => {
    expect(
      getInboundProgressAction({
        status: "ACTIVE",
        currentStep: 0,
        totalQuestions: 5,
        inboundBody: "STOP"
      })
    ).toEqual({ kind: "opt_out" });

    expect(
      getInboundProgressAction({
        status: "OPTED_OUT",
        currentStep: 2,
        totalQuestions: 5,
        inboundBody: "START"
      })
    ).toEqual({ kind: "opt_in" });

    expect(
      getInboundProgressAction({
        status: "OPTED_OUT",
        currentStep: 2,
        totalQuestions: 5,
        inboundBody: "still here"
      })
    ).toEqual({ kind: "ignored_opted_out" });
  });
});
