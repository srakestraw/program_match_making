import React from "react";

export type QuizSwipeVariant = "arrow" | "ghost";

type QuizSwipeIconProps = {
  size?: number;
  className?: string;
  variant?: QuizSwipeVariant;
};

export const QuizSwipeIcon = ({ size = 48, className, variant = "arrow" }: QuizSwipeIconProps) => {
  return (
    <svg
      className={`interview-type-ill interview-type-ill--quiz-swipe interview-type-ill--quiz-${variant} ${className ?? ""}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect className="iti-card iti-card-back" x="11" y="12" width="22" height="26" rx="5" />
      <rect className="iti-card iti-card-mid" x="14" y="10" width="22" height="26" rx="5" />
      <rect className="iti-card iti-card-top" x="17" y="8" width="22" height="26" rx="5" />

      <rect className="iti-ghost-card" x="17" y="8" width="22" height="26" rx="5" />
      <path className="iti-swipe-arrow" d="M30.5 38C34.5 38 37 35.6 37 32.8M37 32.8L34.6 34.7M37 32.8L34.5 30.8" />
    </svg>
  );
};

