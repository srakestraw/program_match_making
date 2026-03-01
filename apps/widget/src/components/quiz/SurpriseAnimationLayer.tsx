type SurpriseVariant = "confetti" | "spark" | "pulse" | "none";

type SurpriseAnimationLayerProps = {
  triggerKey: string | null;
  variant: SurpriseVariant;
  reducedMotion?: boolean;
};

type Particle = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  delayMs: number;
};

const hashString = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildParticles = (seed: string): Particle[] => {
  const result: Particle[] = [];
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

export const SurpriseAnimationLayer = ({ triggerKey, variant, reducedMotion = false }: SurpriseAnimationLayerProps) => {
  if (!triggerKey || reducedMotion || variant === "none") return null;

  if (variant === "confetti") {
    const particles = buildParticles(triggerKey);
    return (
      <div className="surprise-layer surprise-layer-confetti" key={triggerKey} aria-hidden="true" data-testid="surprise-layer">
        {particles.map((particle, index) => (
          <span
            key={`${triggerKey}-${index}`}
            className="surprise-particle"
            style={
              {
                "--sx": `${particle.x}%`,
                "--sy": `${particle.y}%`,
                "--dx": `${particle.dx}px`,
                "--dy": `${particle.dy}px`,
                "--sd": `${particle.delayMs}ms`
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }

  if (variant === "spark") {
    return (
      <div className="surprise-layer surprise-layer-spark" key={triggerKey} aria-hidden="true" data-testid="surprise-layer">
        <span className="surprise-spark-line" />
      </div>
    );
  }

  return (
    <div className="surprise-layer surprise-layer-pulse" key={triggerKey} aria-hidden="true" data-testid="surprise-layer">
      <span className="surprise-pulse-ring" />
    </div>
  );
};

export const pickSurpriseVariant = (questionId: string, sessionId: string | null, reducedMotion = false): SurpriseVariant => {
  if (reducedMotion) return "none";
  const seed = `${sessionId ?? "local"}::${questionId}`;
  const index = hashString(seed) % 3;
  return ["confetti", "spark", "pulse"][index] as SurpriseVariant;
};
import type { CSSProperties } from "react";

