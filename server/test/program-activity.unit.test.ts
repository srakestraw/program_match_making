import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAllProgramsActive, filterActivePrograms } from "../src/lib/program-activity.js";

describe("program activity validation", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("throws in development when inactive programs are present", () => {
    process.env.NODE_ENV = "development";
    expect(() =>
      assertAllProgramsActive(
        [
          { id: "p1", name: "Program One", isActive: true },
          { id: "p2", name: "Program Two", isActive: false }
        ],
        { context: "unit-test" }
      )
    ).toThrowError(/Inactive programs detected/);
  });

  it("warns and filters in production", () => {
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = filterActivePrograms(
      [
        { id: "p1", name: "Program One", isActive: true },
        { id: "p2", name: "Program Two", isActive: false }
      ],
      { context: "unit-test" }
    );

    expect(result).toEqual([{ id: "p1", name: "Program One", isActive: true }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Program Two"));
  });
});
