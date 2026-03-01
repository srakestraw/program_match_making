import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SurpriseAnimationLayer } from "./SurpriseAnimationLayer";
describe("SurpriseAnimationLayer", () => {
    it("disables surprise rendering in reduced motion mode", () => {
        const { queryByTestId } = render(_jsx(SurpriseAnimationLayer, { triggerKey: "abc", variant: "confetti", reducedMotion: true }));
        expect(queryByTestId("surprise-layer")).not.toBeInTheDocument();
    });
    it("renders animation layer when reduced motion is off", () => {
        render(_jsx(SurpriseAnimationLayer, { triggerKey: "abc", variant: "confetti", reducedMotion: false }));
        expect(screen.getByTestId("surprise-layer")).toBeInTheDocument();
    });
});
