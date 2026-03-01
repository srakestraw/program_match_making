import React from "react";

type InterviewTypeChatProps = {
  size?: number;
  className?: string;
};

export const InterviewTypeChat = ({ size = 48, className }: InterviewTypeChatProps) => {
  return (
    <svg
      className={`interview-type-ill interview-type-ill--chat ${className ?? ""}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <g className="iti-chat-back">
        <rect x="10.5" y="11" width="22" height="14" rx="4" />
        <path d="M18 25L15.2 28V25" />
      </g>
      <g className="iti-chat-front">
        <rect x="15.5" y="17" width="22" height="14" rx="4" />
        <path d="M24 31L21.2 34V31" />
      </g>
      <g className="iti-typing-dots" aria-hidden="true">
        <circle className="iti-dot iti-dot-1" cx="23" cy="24" r="1.2" />
        <circle className="iti-dot iti-dot-2" cx="26.8" cy="24" r="1.2" />
        <circle className="iti-dot iti-dot-3" cx="30.6" cy="24" r="1.2" />
      </g>
    </svg>
  );
};
