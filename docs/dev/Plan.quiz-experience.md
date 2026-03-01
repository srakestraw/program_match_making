# Quiz Experience Refactor Plan

## Scope
Implement the trait editor clarity updates, split Quiz vs Chat interaction design, draft/apply AI workflow, widget quiz UX improvements, and seed generation output updates while preserving current admin layout patterns.

## Milestones
1. Recon + contracts
- Confirm current schema, routes, trait editor flow, widget quiz flow, orchestrator scoring payloads, and seed generator outputs.
- Confirm canonical seed source handling with fallback when `/mnt/data/seed-trait-progam.md` is unavailable.

2. Trait editor UX rewrite (admin)
- Rename `Public Experience` to `Student-Facing Label`.
- Add helper text: `Used in the quiz UI and results. Does not affect scoring.`
- Show `displayName` + `shortDescription` fields by default (mapped to existing trait fields).
- Add collapsed `Advanced` section with archetype/icon/mood.
- Add fallback preview when `displayName` is blank.
- Replace mixed question area with `Interaction Design` card and `Quiz`/`Chat` tabs.
- Keep existing left rail / center editor / right used-in-programs layout.

3. Draft + Apply AI workflow
- Student-facing label: keep draft/apply/discard.
- Rubric signals: AI generation writes draft, then explicit apply/discard.
- Interaction design (quiz/chat): AI generation writes draft, then explicit apply/discard.
- Ensure apply only updates drafted fields.

4. Widget quiz UX improvements
- Intro screen content for quiz mode (headline/subheadline/time/start).
- Card-style answer options + microcopy support.
- Progress indicator.
- Live ranking + why match stays visible with top contributors.

5. Seed generation updates
- Keep `pnpm seed:generate` + `--dry-run`.
- Ensure output includes required files and optional `traitsExperience.generated.json`.
- Preserve canonical quiz options exactly.
- Keep deterministic validation report with PASS/FAIL.

6. Validation
- Run and fix until green:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm seed:generate --dry-run`

## Files To Touch (planned)
- `apps/admin/src/main.tsx`
- `apps/widget/src/main.tsx`
- `apps/widget/src/components/ProgramFloatField.tsx` (if explainability display tweak needed)
- `server/src/scripts/seed-generate.ts`
- `server/src/lib/seed-generator.ts` (if schema/report updates required)
- `server/test/seed-generator.unit.test.ts` (if validator coverage changes)
- `docs/QUIZ_EXPERIENCE.md`

## Acceptance Checks
- Trait editor shows clear `Student-Facing Label` card with helper copy and advanced collapsed.
- Interaction Design tabs separate Quiz and Chat cleanly; no mixed prompt UI.
- AI generation paths are draft-first and require Apply/Discard.
- Quiz widget has intro + card answers + progress + ranking/explainability updates.
- Seed generator dry-run passes and outputs contract remains schema-valid.
