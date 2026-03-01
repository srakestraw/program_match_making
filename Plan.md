# Program Match Making - Quiz Experience + AI Seed Updater Plan

## Scope Summary
- Preserve admin page pattern (left rail, center editor, right contextual panel).
- Add experience-layer fields and workflows for Traits + global Quiz Experience config.
- Upgrade widget quiz UX to BuzzFeed-style flow with live movement/explainability while keeping existing scoring pipeline intact.
- Add AI-assisted seed generation workflow from canonical planning doc with structured output + deterministic validation.
- All AI-generated edits remain draft/reviewable before apply.

## Canonical Input
- Requested path: `/mnt/data/seed-trait-progam.md`.
- Runtime fallback found in repo: `docs/seed-trait-progam.md`.

## Milestones

### 1) Recon + Contracts
- Map current schema, API surface, admin pages, widget flows, orchestrator, and seed scripts.
- Define additive data contracts to avoid breaking existing flows.

Acceptance:
- File map and impacted modules identified.
- Backward-compat strategy documented in code comments and types.

### 2) Data Model + APIs (Additive)
- Prisma:
  - Extend `Trait` with Public Experience fields.
  - Extend `TraitQuestion` with Experience Question fields.
  - Add `QuizExperienceConfig` model.
- Server Admin routes:
  - Include new fields in trait/question formatters and CRUD.
  - Add quiz experience config get/upsert endpoint.
  - Add trait experience AI draft endpoint returning structured draft only.

Acceptance:
- Existing trait/program flows still function.
- New fields are persisted and returned by API.

### 3) Admin UX
- Traits page:
  - Add `Public Experience` collapsible card (draft/apply/discard AI suggestions).
  - Refine question editor to `Experience Question` (narrative intro, answer style, option microcopy/icon token/delta).
- Add top nav + route `Quiz Experience` with form + right live preview panel.

Acceptance:
- Admin keeps same layout pattern.
- AI edits are reviewable and require explicit apply.

### 4) Widget UX
- Add hook/intro screen and identity-style quiz cards.
- Add live ranking animations, delta movement, confidence, and “Why this match?” (top contributor traits).
- Keep trait score sidebar but show public labels as primary and canonical trait names secondary.

Acceptance:
- Intro -> question cards -> live moving rankings -> explainability visible.
- Mobile + keyboard accessible interactions remain usable.

### 5) Orchestrator Enhancements
- Ensure orchestrator state includes answered/unanswered/confidence and drives live ranking deltas.
- Add explainability payload using public labels when present.
- Preserve canonical quiz option storage in seed pipeline.

Acceptance:
- Quiz/chat/voice orchestration still works.
- Program fit includes top contributor trait explanation with public labels.

### 6) AI Seed Generator + Validator
- Add `pnpm seed:generate` command.
- CLI reads canonical planning file and uses structured output generation for missing content.
- Local JSON schema validation + deterministic constraints checks.
- Write outputs only to:
  - `docs/seed/seed.generated.json`
  - `docs/seed/validation.generated.json`
- Support `--dry-run` (no writes).
- Add caching + basic rate limiting + prompt trace storage.

Acceptance:
- Dry run emits summary without writing files.
- Full run writes generated artifacts and PASS/FAIL report.
- No existing seed files overwritten.

### 7) QA + Docs
- Add tests for:
  - new API contracts
  - seed schema + validator logic
  - key widget/admin behaviors
- Add `docs/QUIZ_EXPERIENCE.md` for config + generator workflow.

Acceptance:
- Validation commands executed and passing or blockers explicitly fixed/documented.

## Validation Commands
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm seed:generate --dry-run`

## Implementation Notes
- Keep changes additive to reduce regressions.
- Favor new helper modules over large in-place rewrites where possible.
- Do not create integration-test seed data.
