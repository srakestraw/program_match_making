# Brand Voice Data Model

Brand Voice defines how a program or organization communicates: tone, style, and example copy. It is used for live previews, AI-generated samples, and Simulation Lab conversations.

## Persistence (Prisma)

**Table:** `BrandVoice`  
**Schema:** `server/prisma/schema.prisma`

| Column             | Type      | Default | Description |
|--------------------|-----------|---------|-------------|
| `id`               | `String`  | cuid    | Primary key. |
| `name`             | `String`  | —       | Unique display name. |
| `primaryTone`      | `String`  | `"professional"` | Main tone. |
| `ttsVoiceName`     | `String`  | `"alloy"` | Default OpenAI TTS voice for this brand voice. |
| `toneModifiers`    | `String[]`| `[]`    | Additional tone tags. |
| `toneProfile`      | `Json`    | see below | Sliders: formality, warmth, directness, confidence, energy (0–100). |
| `styleFlags`       | `String[]`| `["clear","credible","supportive","future_focused"]` | Desired voice behaviors. |
| `avoidFlags`       | `String[]`| `["jargon_heavy","overly_salesy","impersonal"]` | Behaviors to avoid. |
| `canonicalExamples`| `Json`    | `[]`    | Pinned/generated sample copy. |
| `createdAt`        | `DateTime`| now     | Creation timestamp. |
| `updatedAt`        | `DateTime`| now     | Last update timestamp. |

**Relations:**

- `simulations` → `ConversationSimulation[]` (Simulation Lab runs for this voice).

**Default `toneProfile` (JSON):**

```json
{
  "formality": 75,
  "warmth": 60,
  "directness": 65,
  "confidence": 70,
  "energy": 55
}
```

---

## Domain Types

**Package:** `packages/domain/src/index.ts`

- **`BrandVoice`** – Full voice shape returned by API and used in app:
  - `id`, `name`, `primaryTone`, `ttsVoiceName`, `toneModifiers`, `toneProfile`, `styleFlags`, `avoidFlags`, `canonicalExamples`, `createdAt`, `updatedAt`
- **`ToneProfile`** – `{ formality, warmth, directness, confidence, energy }` (each 0–100).
- **`CanonicalExample`** – `{ id, type, text, pinned }`; `type` is a sample type (e.g. headline, cta).
- **`BrandVoiceTone`** – `"friendly" | "encouraging" | "direct" | "professional" | "playful"`.
- **`BrandVoiceSampleType`** – `"headline" | "cta" | "email_intro" | "description"`.

**Allowed value sets:**

- **Primary tone:** `brandVoiceTones` → friendly, encouraging, direct, professional, playful.
- **Style flags:** `brandVoiceStyleFlagOptions` → clear, credible, supportive, future_focused, empathetic, outcome_oriented, concise.
- **Avoid flags:** `brandVoiceAvoidFlagOptions` → jargon_heavy, overly_salesy, too_casual, impersonal, pushy, vague.

---

## Validation (API)

**Module:** `server/src/lib/brandVoice.ts`

- **`createBrandVoiceSchema`** (Zod):  
  `name` (required, 1–120), `primaryTone` (optional enum), `ttsVoiceName` (optional string), `toneModifiers` (optional array, max 12, each 1–40 chars), `toneProfile` (optional object), `styleFlags` / `avoidFlags` (optional arrays, max 24, each 1–50 chars), `canonicalExamples` (optional array, max 40).
- **`updateBrandVoiceSchema`**: Partial of create schema; at least one field required.
- **`toneProfileSchema`**: All five dimensions required, integer 0–100.
- **`canonicalExampleSchema`**: `id`, `type` (sample type enum), `text` (1–400 chars), `pinned` (boolean, default true).

**Defaults:** `brandVoiceDefaults` in `brandVoice.ts` (primaryTone, toneModifiers, toneProfile, styleFlags, avoidFlags).

---

## API Shape

Admin routes serialize Brand Voice with `formatBrandVoice` in `server/src/routes/admin.ts`:

- Prisma `Json` fields are normalized: `toneProfile` → `normalizeToneProfile`, `canonicalExamples` → `normalizeCanonicalExamples`.
- Arrays (`toneModifiers`, `styleFlags`, `avoidFlags`) are returned as arrays (empty array if not stored as array).
- Timestamps are ISO strings (`createdAt`, `updatedAt`).

**Endpoints:**

- `GET /api/admin/brand-voices` – List all.
- `POST /api/admin/brand-voices` – Create (body: createBrandVoiceSchema).
- `PUT /api/admin/brand-voices/:id` – Update (body: updateBrandVoiceSchema).
- `DELETE /api/admin/brand-voices/:id` – Delete (cascade to simulations).
- `POST /api/admin/brand-voices/:id/generate-samples` – Generate AI samples (headline, cta, email_intro, description).
- `POST /api/admin/brand-voices/test-voice` – Test selected OpenAI voice from Brand Voice configuration.
- `POST /api/admin/brand-voices/:id/simulations` – Run Simulation Lab (request body includes scenario/persona).

---

## Usage

- **Preview:** `generateBrandVoicePreview(BrandVoicePreviewInput)` in `@pmm/domain` produces placeholder headline, cta, email_intro, description from tone/profile/flags (no AI).
- **Prompt:** `buildBrandVoicePrompt(...)` in `server/src/lib/brandVoice.ts` builds the text prompt used for AI sample generation and simulations (name, tone, profile, flags, canonical examples, context).
- **Admin UI:** Brand Voice CRUD and Simulation Lab live in `apps/admin` (e.g. `BrandVoicePage`, `SimulationLab`).
