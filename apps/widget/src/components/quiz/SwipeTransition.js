import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
const SWIPE_DURATION_MS = 280;
export const SwipeTransition = ({ activeKey, direction = "forward", reducedMotion = false, className, children }) => {
    const rootRef = useRef(null);
    const timeoutRef = useRef(null);
    const currentKeyRef = useRef(activeKey);
    const currentContentRef = useRef(children);
    const [lockedMinHeight, setLockedMinHeight] = useState(null);
    const [items, setItems] = useState([
        {
            id: `steady-${activeKey}`,
            activeKey,
            content: children,
            role: "steady"
        }
    ]);
    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null)
                window.clearTimeout(timeoutRef.current);
        };
    }, []);
    useEffect(() => {
        if (currentKeyRef.current === activeKey) {
            currentContentRef.current = children;
            setItems((prev) => [
                {
                    id: prev[0]?.id ?? `steady-${activeKey}`,
                    activeKey,
                    content: children,
                    role: "steady"
                }
            ]);
            return;
        }
        if (timeoutRef.current !== null)
            window.clearTimeout(timeoutRef.current);
        const measured = rootRef.current?.getBoundingClientRect().height ?? null;
        if (measured && measured > 0)
            setLockedMinHeight(measured);
        if (reducedMotion) {
            setItems([
                {
                    id: `steady-${activeKey}`,
                    activeKey,
                    content: children,
                    role: "steady"
                }
            ]);
            setLockedMinHeight(null);
            currentKeyRef.current = activeKey;
            currentContentRef.current = children;
            return;
        }
        setItems([
            {
                id: `exit-${currentKeyRef.current}-${Date.now()}`,
                activeKey: currentKeyRef.current,
                content: currentContentRef.current,
                role: "exit"
            },
            {
                id: `enter-${activeKey}-${Date.now()}`,
                activeKey,
                content: children,
                role: "enter"
            }
        ]);
        timeoutRef.current = window.setTimeout(() => {
            setItems([
                {
                    id: `steady-${activeKey}`,
                    activeKey,
                    content: children,
                    role: "steady"
                }
            ]);
            setLockedMinHeight(null);
            currentKeyRef.current = activeKey;
            currentContentRef.current = children;
        }, SWIPE_DURATION_MS + 24);
    }, [activeKey, children, reducedMotion]);
    return (_jsx("div", { ref: rootRef, className: `swipe-transition-root ${className ?? ""}`.trim(), style: lockedMinHeight ? { minHeight: `${Math.ceil(lockedMinHeight)}px` } : undefined, "data-testid": "swipe-transition-root", children: items.map((item) => (_jsx("div", { className: [
                "swipe-transition-item",
                reducedMotion ? "swipe-transition-fade" : "",
                !reducedMotion && item.role === "enter" ? `swipe-transition-enter-${direction}` : "",
                !reducedMotion && item.role === "exit" ? `swipe-transition-exit-${direction}` : "",
                item.role === "steady" ? "swipe-transition-steady" : "swipe-transition-floating"
            ]
                .filter(Boolean)
                .join(" "), "aria-live": item.role === "enter" || item.role === "steady" ? "polite" : undefined, children: item.content }, item.id))) }));
};
