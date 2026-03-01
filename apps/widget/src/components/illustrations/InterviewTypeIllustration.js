import { jsx as _jsx } from "react/jsx-runtime";
import { InterviewTypeChat } from "./InterviewTypeChat";
import { InterviewTypeQuiz } from "./InterviewTypeQuiz";
import { InterviewTypeVoice } from "./InterviewTypeVoice";
export const InterviewTypeIllustration = ({ type, size = 48, className }) => {
    if (type === "voice")
        return _jsx(InterviewTypeVoice, { size: size, className: className });
    if (type === "chat")
        return _jsx(InterviewTypeChat, { size: size, className: className });
    return _jsx(InterviewTypeQuiz, { size: size, className: className });
};
