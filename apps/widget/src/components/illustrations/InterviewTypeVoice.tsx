import React from "react";

type InterviewTypeVoiceProps = {
  size?: number;
  className?: string;
};

export const InterviewTypeVoice = ({ size = 48, className }: InterviewTypeVoiceProps) => {
  return (
    <svg
      className={`interview-type-ill interview-type-ill--voice ${className ?? ""}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle className="iti-ring" cx="24" cy="24" r="18" />
      <circle className="iti-orb" cx="24" cy="24" r="12" />
      <g className="iti-wave" aria-hidden="true">
        <rect className="iti-bar iti-bar-1" x="18" y="19" width="3" height="10" rx="1.5" />
        <rect className="iti-bar iti-bar-2" x="22.5" y="16.5" width="3" height="15" rx="1.5" />
        <rect className="iti-bar iti-bar-3" x="27" y="19" width="3" height="10" rx="1.5" />
      </g>
    </svg>
  );
};
