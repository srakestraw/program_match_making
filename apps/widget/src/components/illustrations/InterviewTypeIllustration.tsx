import React from "react";
import { InterviewTypeChat } from "./InterviewTypeChat";
import { InterviewTypeVoice } from "./InterviewTypeVoice";
import { QuizSwipeIcon, type QuizSwipeVariant } from "./QuizSwipeIcon";

type InterviewTypeIllustrationProps = {
  type: "voice" | "chat" | "quiz";
  size?: number;
  className?: string;
  quizVariant?: QuizSwipeVariant;
};

export const InterviewTypeIllustration = ({ type, size = 48, className, quizVariant = "ghost" }: InterviewTypeIllustrationProps) => {
  if (type === "voice") return <InterviewTypeVoice size={size} className={className} />;
  if (type === "chat") return <InterviewTypeChat size={size} className={className} />;
  return <QuizSwipeIcon size={size} className={className} variant={quizVariant} />;
};
