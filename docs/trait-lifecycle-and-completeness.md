# Trait Lifecycle And Completeness

Traits now use an explicit lifecycle:

- `DRAFT` (default)
- `IN_REVIEW`
- `ACTIVE`
- `DEPRECATED`

## Completeness rules for activation

A trait is considered complete when it has all of the following:

- non-empty `name`
- valid `category`
- non-empty `definition`
- at least 3 positive rubric signals
- at least 2 negative rubric signals
- at least 1 trait question

Only complete traits can transition to `ACTIVE`. Server-side validation enforces this and returns:

- `code: "TRAIT_INCOMPLETE"`
- `missing: string[]`
- `details` with counts and percent complete

## Scoring eligibility

Only `ACTIVE` traits are included in scoring.

If a program board references non-active traits, they are excluded during scoring and warning metadata is returned with trait id, name, status, and reason.

## Admin behavior

- Trait list shows lifecycle status and completeness progress.
- Trait editor shows activation guidance and missing checklist when incomplete.
- Program board flags non-active traits as excluded from scoring.
- Add Trait flow defaults to `Show only Active` and allows adding non-active traits with a confirmation warning.
