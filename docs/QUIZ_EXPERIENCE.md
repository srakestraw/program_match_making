# Quiz Experience + Seed Generation

This document covers:
- Admin and widget "Quiz Experience" configuration.
- Trait-level public experience and experience question fields.
- AI-assisted seed generation and deterministic validation.

## Admin Configuration

### Quiz Experience (global)
Route: `Admin -> Quiz Experience`

Fields:
- `headline`
- `subheadline`
- `estimatedTimeLabel`
- `tonePreset`
- `gradientSet`
- `motionIntensity`
- `rankingMotionStyle`
- `revealStyle`
- `introMediaPrompt` (optional)
- `revealMediaPrompt` (optional)

API:
- `GET /api/admin/quiz-experience`
- `PUT /api/admin/quiz-experience`
- Public read: `GET /api/public/quiz-experience`

Notes:
- Sora prompts are stored as config only.
- No per-question video generation is required.

### Trait: Public Experience
Route: `Admin -> Traits -> Trait detail`

Fields:
- `publicLabel`
- `oneLineHook`
- `archetypeTag`
- `displayIcon`
- `visualMood`

AI actions:
- Generate with AI
- Rewrite for Gen Z
- Simplify
- Make more aspirational

All AI outputs are draft-first and require explicit Apply/Discard in UI.

### Trait: Experience Question
Question editor supports:
- `narrativeIntro`
- `questionText`
- `answerStyle` (`RADIO | CARD_GRID | SLIDER | CHAT`)
- `answerOptionsMeta[]` (`label`, optional `microCopy`, `iconToken`, `traitScore`)

Canonical seed constraint for QUIZ options remains:
`["Beginner","Developing","Proficient","Advanced"]`

## Data Model

Prisma additions:
- Enums: `TraitAnswerStyle`, `TraitVisualMood`
- `Trait` columns:
  - `publicLabel`
  - `oneLineHook`
  - `archetypeTag`
  - `displayIcon`
  - `visualMood`
  - `experienceDraftJson`
- `TraitQuestion` columns:
  - `narrativeIntro`
  - `answerStyle`
  - `answerOptionsMetaJson`
- New model: `QuizExperienceConfig`

Migration:
- `server/prisma/migrations/20260228190000_quiz_experience_layer/`

## Seed Generation Workflow

### Command
- Dry run: `pnpm seed:generate --dry-run`
- Write artifacts: `pnpm seed:generate`

### Inputs
- Canonical planning file (read-only): `/mnt/data/seed-trait-progam.md`
- Fallback in repo if canonical path is unavailable: `docs/seed-trait-progam.md`

### Outputs
- `docs/seed/seed.generated.json`
- `docs/seed/validation.generated.json`
- `docs/seed/ai-cache.generated.json` (generation cache)

No production seed files are overwritten silently.

### Generator behavior
Implemented in:
- `server/src/scripts/seed-generate.ts`
- `server/src/lib/seed-generator.ts`

Features:
- Structured-output AI generation (JSON-schema validated locally)
- Rate-limited AI calls
- Per-trait cache for generated content
- Dry-run mode
- Deterministic non-AI validator checks

Validator checks include:
- Program bucket counts (`CRITICAL=2`, `VERY_IMPORTANT=1`, `IMPORTANT=1`, `NICE_TO_HAVE=1`)
- Total traits per program (`5`)
- Duplicate trait names
- Duplicate `(programName, traitName)`
- Trait usage frequency table
- Traits used once (flag)
- Per-trait question counts (`2 CHAT + 1 QUIZ`)
- PASS/FAIL summary

## Validation Commands

Run from repo root:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm seed:generate --dry-run`
