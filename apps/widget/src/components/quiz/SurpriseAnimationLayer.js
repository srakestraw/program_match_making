import { jsx as _jsx } from "react/jsx-runtime";
const hashString = (input) => {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};
const buildParticles = (seed) => {
    const result = [];
    const base = hashString(seed);
    for (let index = 0; index < 10; index += 1) {
        const value = (base + index * 37) % 997;
        result.push({
            x: 12 + (value % 76),
            y: 58 + ((value * 3) % 20),
            dx: -18 + (value % 36),
            dy: -18 - (value % 18),
            delayMs: (value % 90) + index * 10
        });
    }
    return result;
};
export const SurpriseAnimationLayer = ({ triggerKey, variant, reducedMotion = false }) => {
    if (!triggerKey || reducedMotion || variant === "none")
        return null;
    if (variant === "confetti") {
        const particles = buildParticles(triggerKey);
        return (_jsx("div", { className: "surprise-layer surprise-layer-confetti", "aria-hidden": "true", "data-testid": "surprise-layer", children: particles.map((particle, index) => (_jsx("span", { className: "surprise-particle", style: {
                    "--sx": `${particle.x}%`,
                    "--sy": `${particle.y}%`,
                    "--dx": `${particle.dx}px`,
                    "--dy": `${particle.dy}px`,
                    "--sd": `${particle.delayMs}ms`
                } }, `${triggerKey}-${index}`))) }, triggerKey));
    }
    if (variant === "spark") {
        return (_jsx("div", { className: "surprise-layer surprise-layer-spark", "aria-hidden": "true", "data-testid": "surprise-layer", children: _jsx("span", { className: "surprise-spark-line" }) }, triggerKey));
    }
    return (_jsx("div", { className: "surprise-layer surprise-layer-pulse", "aria-hidden": "true", "data-testid": "surprise-layer", children: _jsx("span", { className: "surprise-pulse-ring" }) }, triggerKey));
};
export const pickSurpriseVariant = (questionId, sessionId, reducedMotion = false) => {
    if (reducedMotion)
        return "none";
    const seed = `${sessionId ?? "local"}::${questionId}`;
    const index = hashString(seed) % 3;
    return ["confetti", "spark", "pulse"][index];
};
