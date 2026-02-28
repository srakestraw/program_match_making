# Trait and Program Data Model

Traits are reusable scoring dimensions (e.g. Communication, Leadership). Programs are offerings (e.g. MS Data Science) that assign traits with a priority bucket and order. Program–trait assignment drives interview question selection, scorecard weighting, and program-fit ranking.

## Enums

**Schema:** `server/prisma/schema.prisma`  
**Types:** `packages/domain/src/index.ts`

| Enum | Values | Purpose |
|------|--------|---------|
| **TraitCategory** | `ACADEMIC`, `INTERPERSONAL`, `MOTIVATION`, `EXPERIENCE`, `LEADERSHIP`, `PROBLEM_SOLVING` | Grouping and question diversity (e.g. avoid too many same-category questions in a row). |
| **ProgramTraitPriorityBucket** | `CRITICAL`, `VERY_IMPORTANT`, `IMPORTANT`, `NICE_TO_HAVE` | How important a trait is for a program; used for weighted scoring and explainability. |
| **TraitQuestionType** | `CHAT`, `QUIZ` | Elicitation style: open-ended (chat) vs structured options (quiz). |

Domain constants: `traitCategories`, `programTraitPriorityBuckets`, `traitQuestionTypes`.

---

## Trait

A **Trait** is a single dimension used to evaluate candidates. It has a name, category, optional definition, and a rubric (scale + positive/negative signals + follow-ups) used by the scoring pipeline.

### Persistence (Prisma)

**Table:** `Trait`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `String` | cuid | Primary key. |
| `name` | `String` | — | Unique display name. |
| `category` | `TraitCategory` | — | Category enum. |
| `definition` | `String?` | — | Human-readable definition for prompts and scoring. |
| `rubricScaleMin` | `Int` | 0 | Minimum of scoring scale (e.g. 0). |
| `rubricScaleMax` | `Int` | 5 | Maximum of scoring scale (e.g. 5). |
| `rubricPositiveSignals` | `String?` | — | Newline-separated positive signals for evaluator. |
| `rubricNegativeSignals` | `String?` | — | Newline-separated negative signals for evaluator. |
| `rubricFollowUps` | `String?` | — | Optional follow-up prompts for evaluator. |
| `createdAt` | `DateTime` | now | Creation timestamp. |
| `updatedAt` | `DateTime` | now | Last update timestamp. |

**Relations:**

- `questions` → `TraitQuestion[]`
- `programTraits` → `ProgramTrait[]`
- `traitScores` → `TraitScore[]` (scorecard line items)
- `candidateTraitScores` → `CandidateTraitScore[]` (session-level adaptive scores)

### Domain Type

**Package:** `packages/domain/src/index.ts`

```ts
type Trait = {
  id: string;
  name: string;
  category: TraitCategory;
  definition: string | null;
  rubricScaleMin: number;
  rubricScaleMax: number;
  rubricPositiveSignals: string | null;
  rubricNegativeSignals: string | null;
  rubricFollowUps: string | null;
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
};
```

---

## TraitQuestion

A **TraitQuestion** belongs to one Trait and is used to elicit evidence (chat or quiz). Questions do not define scoring; the parent Trait’s definition and rubric drive evaluation.

### Persistence (Prisma)

**Table:** `TraitQuestion`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `String` | cuid | Primary key. |
| `traitId` | `String` | — | FK → `Trait.id`. |
| `type` | `TraitQuestionType` | — | `CHAT` or `QUIZ`. |
| `prompt` | `String` | — | Question text. |
| `optionsJson` | `String?` | — | JSON array of option strings (for QUIZ). |
| `createdAt` | `DateTime` | now | Creation timestamp. |
| `updatedAt` | `DateTime` | now | Last update timestamp. |

**Relations:** `trait` → `Trait`; `traitScores` → `TraitScore[]`.

### Domain Type

```ts
type TraitQuestion = {
  id: string;
  traitId: string;
  type: TraitQuestionType;
  prompt: string;
  optionsJson: string[] | null;  // parsed from DB string
  createdAt: string;
  updatedAt: string;
};
```

---

## Program

A **Program** is an offering (e.g. degree program) that has a name and optional metadata. Its traits are defined via **ProgramTrait** rows.

### Persistence (Prisma)

**Table:** `Program`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `String` | cuid | Primary key. |
| `name` | `String` | — | Unique display name. |
| `description` | `String?` | — | Optional description. |
| `degreeLevel` | `String?` | — | e.g. "Master's", "Certificate". |
| `department` | `String?` | — | Owning department. |
| `createdAt` | `DateTime` | now | Creation timestamp. |
| `updatedAt` | `DateTime` | now | Last update timestamp. |

**Relations:**

- `traits` → `ProgramTrait[]`
- `scorecards` → `Scorecard[]`
- `sessions` → `CandidateSession[]`
- `leads` → `Lead[]`

### Domain Type

```ts
type Program = {
  id: string;
  name: string;
  description: string | null;
  degreeLevel: string | null;
  department: string | null;
  createdAt: string;
  updatedAt: string;
};
```

---

## ProgramTrait

**ProgramTrait** is the join between Program and Trait. It assigns a trait to a program with a **priority bucket** and **sort order** (for stable ordering within a bucket). Optional notes are for admin use.

### Persistence (Prisma)

**Table:** `ProgramTrait`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `String` | cuid | Primary key. |
| `programId` | `String` | — | FK → `Program.id`. |
| `traitId` | `String` | — | FK → `Trait.id`. |
| `bucket` | `ProgramTraitPriorityBucket` | — | CRITICAL \| VERY_IMPORTANT \| IMPORTANT \| NICE_TO_HAVE. |
| `sortOrder` | `Int` | — | Order within bucket (lower = higher priority). |
| `notes` | `String?` | — | Optional admin notes. |

**Unique:** `(programId, traitId)`.  
**Relations:** `program` → `Program`; `trait` → `Trait`.

### Domain Type

```ts
type ProgramTrait = {
  id: string;
  programId: string;
  traitId: string;
  bucket: ProgramTraitPriorityBucket;
  sortOrder: number;
  notes: string | null;
};
```

### Usage

- **Admin:** Trait Priority Board edits program traits by bucket and order; saved as `PUT /api/admin/programs/:id/traits` with `items: { traitId, bucket, sortOrder }[]`.
- **Scoring:** Bucket maps to weight in `scoreCandidateSession` (e.g. CRITICAL=1, VERY_IMPORTANT=0.75, IMPORTANT=0.5, NICE_TO_HAVE=0.25). See `packages/domain` `ScoringInput` / `ScoringOutput`.
- **Ranking:** `rankProgramsByTraits` uses `ProgramMatchInput.traits` (traitId + weight); weights are typically derived from program’s ProgramTrait rows.
- **Board state:** `ProgramTraitBoardState` = `Record<ProgramTraitPriorityBucket, string[]>` (trait IDs per bucket). `boardStateToProgramTraitRows` converts to `ProgramTraitRowInput[]`.

---

## Related Domain Types (no separate tables)

- **TraitState** – Runtime view: `traitId`, `traitName`, `category?`, `score0to5`, `confidence0to1` (used in widget/ranking).
- **ProgramMatchInput** – `programId`, `programName`, `traits: { traitId, weight }[]` (input to ranking).
- **ProgramTraitBoardState** / **ProgramTraitRowInput** – Board ↔ API conversion (see above).
- **ScoringInput** / **ScoringOutput** – Per-trait raw scores and bucket weights → overall + per-trait scores.

---

## API Summary

| Area | Endpoints |
|------|-----------|
| Admin traits | `GET/POST /api/admin/traits`, `GET/PUT/DELETE /api/admin/traits/:id`, `GET/POST /api/admin/traits/:id/questions`, `PUT/DELETE /api/admin/questions/:questionId` |
| Admin programs | `GET/POST /api/admin/programs`, `GET/PUT/DELETE /api/admin/programs/:id`, `GET/PUT /api/admin/programs/:id/traits` |
| Public | `GET /api/public/programs`, `GET /api/public/programs/:id`, `GET /api/public/programs/:id/questions?type=chat|quiz` |

Schema and migrations: `server/prisma/schema.prisma`; generate with `pnpm db:generate`, apply with `pnpm db:migrate`.
