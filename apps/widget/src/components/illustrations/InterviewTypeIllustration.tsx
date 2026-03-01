import React from "react";
import { InterviewTypeChat } from "./InterviewTypeChat";
import { InterviewTypeQuiz } from "./InterviewTypeQuiz";
import { InterviewTypeVoice } from "./InterviewTypeVoice";

type InterviewTypeIllustrationProps = {
  type: "voice" | "chat" | "quiz";
  size?: number;
  className?: string;
};

export const InterviewTypeIllustration = ({ type, size = 48, className }: InterviewTypeIllustrationProps) => {
  if (type === "voice") return <InterviewTypeVoice size={size} className={className} />;
  if (type === "chat") return <InterviewTypeChat size={size} className={className} />;
  return <InterviewTypeQuiz size={size} className={className} />;
};
