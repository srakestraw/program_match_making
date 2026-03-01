import React from "react";

type InterviewTypeQuizProps = {
  size?: number;
  className?: string;
};

export const InterviewTypeQuiz = ({ size = 48, className }: InterviewTypeQuizProps) => {
  return (
    <svg
      className={`interview-type-ill interview-type-ill--quiz ${className ?? ""}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect className="iti-card-front" x="12" y="9" width="24" height="30" rx="5" />
      <rect className="iti-header" x="16" y="13" width="13" height="2" rx="1" />
      <circle className="iti-badge" cx="31" cy="14" r="2.4" />
      <path className="iti-badge-mark" d="M30.9 12.8C31.5 12.8 31.9 13.2 31.9 13.7C31.9 14.4 31 14.4 31 15.1" />
      <circle className="iti-badge-mark-dot" cx="31" cy="16.4" r="0.5" />

      <rect className="iti-option iti-option-1" x="16" y="19" width="16" height="4" rx="2" />
      <rect className="iti-option iti-option-2" x="16" y="24" width="16" height="4" rx="2" />
      <rect className="iti-option iti-option-3" x="16" y="29" width="16" height="4" rx="2" />
      <rect className="iti-option-active" x="16" y="19" width="16" height="4" rx="2" />

      <rect className="iti-progress-track" x="16" y="35.2" width="16" height="1.8" rx="0.9" />
      <rect className="iti-progress-fill" x="16" y="35.2" width="16" height="1.8" rx="0.9" />
    </svg>
  );
};
