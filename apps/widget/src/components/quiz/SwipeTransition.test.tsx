import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SwipeTransition } from "./SwipeTransition";

describe("SwipeTransition", () => {
  it("renders next question content when active key changes", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <SwipeTransition activeKey="q1" direction="forward">
        <p>Question A</p>
      </SwipeTransition>
    );

    expect(screen.getByText("Question A")).toBeInTheDocument();

    rerender(
      <SwipeTransition activeKey="q2" direction="forward">
        <p>Question B</p>
      </SwipeTransition>
    );

    expect(screen.getByText("Question B")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
