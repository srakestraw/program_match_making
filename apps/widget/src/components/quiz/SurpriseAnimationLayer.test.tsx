import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SurpriseAnimationLayer } from "./SurpriseAnimationLayer";

describe("SurpriseAnimationLayer", () => {
  it("disables surprise rendering in reduced motion mode", () => {
    const { queryByTestId } = render(<SurpriseAnimationLayer triggerKey="abc" variant="confetti" reducedMotion />);
    expect(queryByTestId("surprise-layer")).not.toBeInTheDocument();
  });

  it("renders animation layer when reduced motion is off", () => {
    render(<SurpriseAnimationLayer triggerKey="abc" variant="confetti" reducedMotion={false} />);
    expect(screen.getByTestId("surprise-layer")).toBeInTheDocument();
  });
});

