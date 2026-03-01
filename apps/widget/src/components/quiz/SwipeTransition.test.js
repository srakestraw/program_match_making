import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SwipeTransition } from "./SwipeTransition";
describe("SwipeTransition", () => {
    it("renders next question content when active key changes", () => {
        vi.useFakeTimers();
        const { rerender } = render(_jsx(SwipeTransition, { activeKey: "q1", direction: "forward", children: _jsx("p", { children: "Question A" }) }));
        expect(screen.getByText("Question A")).toBeInTheDocument();
        rerender(_jsx(SwipeTransition, { activeKey: "q2", direction: "forward", children: _jsx("p", { children: "Question B" }) }));
        expect(screen.getByText("Question B")).toBeInTheDocument();
        vi.useRealTimers();
    });
});
