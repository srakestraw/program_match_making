import { describe, expect, it } from "vitest";
import { mapTwilioStatusToCallStatus } from "../src/phone/status.js";

describe("mapTwilioStatusToCallStatus", () => {
  it("maps standard Twilio statuses", () => {
    expect(mapTwilioStatusToCallStatus("initiated")).toBe("INITIATED");
    expect(mapTwilioStatusToCallStatus("ringing")).toBe("RINGING");
    expect(mapTwilioStatusToCallStatus("in-progress")).toBe("IN_PROGRESS");
    expect(mapTwilioStatusToCallStatus("completed")).toBe("COMPLETED");
    expect(mapTwilioStatusToCallStatus("busy")).toBe("BUSY");
    expect(mapTwilioStatusToCallStatus("no-answer")).toBe("NO_ANSWER");
    expect(mapTwilioStatusToCallStatus("canceled")).toBe("CANCELED");
    expect(mapTwilioStatusToCallStatus("failed")).toBe("FAILED");
  });
});
