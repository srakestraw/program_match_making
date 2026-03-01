import { jsx as _jsx } from "react/jsx-runtime";
import { InterviewTypeChat } from "./InterviewTypeChat";
import { InterviewTypeVoice } from "./InterviewTypeVoice";
import { QuizSwipeIcon } from "./QuizSwipeIcon";
export const InterviewTypeIllustration = ({ type, size = 48, className, quizVariant = "ghost" }) => {
    if (type === "voice")
        return _jsx(InterviewTypeVoice, { size: size, className: className });
    if (type === "chat")
        return _jsx(InterviewTypeChat, { size: size, className: className });
    return _jsx(QuizSwipeIcon, { size: size, className: className, variant: quizVariant });
};
