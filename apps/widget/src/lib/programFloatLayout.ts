import type { ProgramFit } from "@pmm/api-client";

export type BubbleLayout = {
  programId: string;
  xPct: number;
  yPct: number;
  sizePx: number;
  opacity: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const seededOffset = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 9973;
  }
  return (hash % 1000) / 1000;
};

export const computeProgramBubbleLayout = (input: {
  programs: ProgramFit["programs"];
  selectedProgramId?: string | null;
  widthPx?: number;
  heightPx?: number;
}): BubbleLayout[] => {
  const width = input.widthPx ?? 520;
  const height = input.heightPx ?? 340;
  const centerX = 50;
  const centerY = 45;

  const items = input.programs.map((program, index) => {
    const normalized = clamp(program.fitScore_0_to_100 / 100, 0, 1);
    const angle = (index / Math.max(1, input.programs.length)) * Math.PI * 2 + seededOffset(program.programId) * 0.45;
    const baseRadius = 7 + (1 - normalized) * 33;
    const radius = input.selectedProgramId === program.programId ? baseRadius * 0.65 : baseRadius;

    const baseSize = 66 + normalized * 44;
    const selectedBoost = input.selectedProgramId === program.programId ? 8 : 0;
    const sizePx = Math.round(baseSize + selectedBoost);

    const xPct = clamp(centerX + Math.cos(angle) * radius, 8, 92);
    const yPct = clamp(centerY + Math.sin(angle) * radius + (1 - normalized) * 14, 10, 90);

    return {
      programId: program.programId,
      xPct,
      yPct,
      sizePx,
      opacity: Number((0.5 + normalized * 0.5).toFixed(2))
    } satisfies BubbleLayout;
  });

  for (let iteration = 0; iteration < 3; iteration += 1) {
    for (let left = 0; left < items.length; left += 1) {
      for (let right = left + 1; right < items.length; right += 1) {
        const a = items[left]!;
        const b = items[right]!;

        const dxPx = ((b.xPct - a.xPct) / 100) * width;
        const dyPx = ((b.yPct - a.yPct) / 100) * height;
        const distance = Math.sqrt(dxPx * dxPx + dyPx * dyPx) || 1;
        const minDistance = a.sizePx * 0.48 + b.sizePx * 0.48;

        if (distance < minDistance) {
          const push = (minDistance - distance) / 2;
          const ux = dxPx / distance;
          const uy = dyPx / distance;
          const pushXPct = (push * ux * 100) / width;
          const pushYPct = (push * uy * 100) / height;

          a.xPct = clamp(a.xPct - pushXPct, 6, 94);
          a.yPct = clamp(a.yPct - pushYPct, 8, 92);
          b.xPct = clamp(b.xPct + pushXPct, 6, 94);
          b.yPct = clamp(b.yPct + pushYPct, 8, 92);
        }
      }
    }
  }

  return items;
};
