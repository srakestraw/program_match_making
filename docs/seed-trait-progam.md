# Trait + Program Reseed Runbook (New Model + Interaction Design)

This document replaces the old planning prompt and matches the current Prisma/domain model.

## Goal

Delete existing trait/program data and reseed with canonical payloads, while aligning with the new fields used by quiz/interaction design.

## Current Model Snapshot

### Trait (`Trait`)
Required/core seed fields:
- `name`
- `category` (`ACADEMIC | INTERPERSONAL | MOTIVATION | EXPERIENCE | LEADERSHIP | PROBLEM_SOLVING`)
- `status` (`DRAFT | IN_REVIEW | ACTIVE | DEPRECATED`)
- `definition`
- `rubricScaleMin` (use `0`)
- `rubricScaleMax` (use `5`)
- `rubricPositiveSignals` (newline text)
- `rubricNegativeSignals` (newline text)
- `rubricFollowUps` (newline text; optional)

Interaction Design fields on trait:
- `publicLabel`
- `oneLineHook`
- `archetypeTag` (`ANALYST | BUILDER | STRATEGIST | OPERATOR | VISIONARY | LEADER | COMMUNICATOR`)
- `displayIcon`
- `visualMood` (`NEUTRAL | ASPIRATIONAL | PLAYFUL | BOLD | SERIOUS`)
- `experienceDraftJson` (optional serialized draft/meta)

### TraitQuestion (`TraitQuestion`)
Core fields:
- `traitId`
- `type` (`CHAT | QUIZ`)
- `prompt`
- `optionsJson` (required for `QUIZ`)

Interaction Design fields on question:
- `narrativeIntro`
- `answerStyle` (`RADIO | CARD_GRID | SLIDER | CHAT`)
- `answerOptionsMetaJson` (serialized per-option metadata)

### Program (`Program`)
Seed fields:
- `name`
- `description`
- `degreeLevel`
- `department`
- `isActive` (set `true` for seeded programs)

### ProgramTrait (`ProgramTrait`)
Seed fields:
- `programId`
- `traitId`
- `bucket` (`CRITICAL | VERY_IMPORTANT | IMPORTANT | NICE_TO_HAVE`)
- `sortOrder`
- `notes`

## Canonical Seed Sources

- Traits/programs/program-trait plan: `server/src/scripts/seed-payloads.ts`
- Deterministic DB reseed script: `server/src/scripts/seed-gsu-programs.ts`
- Generated payloads (includes interaction-design question/trait fields): `server/src/scripts/seed-generate.ts`

## Delete + Reseed Commands

Run from repo root:

1. Validate canonical payload rules.
```bash
pnpm --filter @pmm/server seed:validate
```

2. Delete existing trait/program/candidate data (keeps brand voice data).
```bash
pnpm --filter @pmm/server clean-traits-programs-candidates
```

3. Reseed canonical traits, trait questions, programs, and program-trait assignments.
```bash
pnpm --filter @pmm/server seed:gsu-programs
```

4. (Optional) Generate interaction-design-aware seed artifacts for review/export.
```bash
pnpm --filter @pmm/server seed:generate
```

Generated files:
- `docs/seed/seed.generated.json`
- `docs/seed/validation.generated.json`
- `docs/seed/traitsExperience.generated.json`

## Interaction Design Seeding Notes

- `seed:gsu-programs` is the canonical DB reseed for traits/programs/questions and sets traits to `ACTIVE`.
- `seed:generate` produces richer payload artifacts including:
  - trait experience fields (`publicLabel`, `oneLineHook`, `archetypeTag`, `displayIcon`, `visualMood`)
  - question UX fields (`narrativeIntro`, `answerStyle`, `answerOptionsMeta`)
- If you need those interaction fields persisted in DB, apply them via admin APIs/UI after reseed.

## Constraints

- Do not create seed data as part of integration tests.
- Keep trait definitions reusable across programs; no program-name traits.
- Keep quiz options canonical where required: `["Beginner","Developing","Proficient","Advanced"]`.
