# Program Match Making (Monorepo)

V1 monorepo for Program Match Making with three apps and one Express server:
- Admin app (Traits, Programs, Brand Voice stubs)
- Widget app (Voice NOW vertical slice)
- Advisor app (candidate management stub)
- Express + Prisma + SQLite backend

## Tech
- Monorepo: pnpm workspaces + Turborepo
- Frontend: React + Vite + TypeScript + Tailwind
- State: TanStack Query + Zustand
- Validation: Zod
- Backend: Node + Express + TypeScript
- Persistence: Prisma + SQLite
- Voice: OpenAI Realtime WebRTC with server-minted ephemeral client secret

## Prerequisites
- Node 20+
- pnpm 10+

## Setup
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy env file and set API key:
   ```bash
   cp .env.example .env
   ```
3. Set `OPENAI_API_KEY` in `.env`.
   Optional hardening env vars:
   - `WIDGET_ALLOWED_ORIGINS` (comma-separated origins)
   - `JSON_BODY_LIMIT` (default `100kb`)
   - `PUBLIC_RATE_LIMIT_WINDOW_MS`, `PUBLIC_RATE_LIMIT_TOKEN_MAX`, `PUBLIC_RATE_LIMIT_LEAD_MAX`, `PUBLIC_RATE_LIMIT_SCORE_MAX`
   - `OPENAI_TIMEOUT_MS`, `OPENAI_MAX_RETRIES`
   - `LOG_LEVEL`
4. Generate Prisma client and create SQLite schema:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```
   `db:migrate` applies checked-in SQL migrations:
   - `server/prisma/migrations/202602241620_admin_foundation/migration.sql`
   - `server/prisma/migrations/202602241900_step3_scorecards/migration.sql`
   - `server/prisma/migrations/202602241980_step4_candidate_leads/migration.sql`
   - `server/prisma/migrations/202602242040_step5_indexes/migration.sql`
   - `server/prisma/migrations/202602242230_step6_phone_calls/migration.sql`
   - `server/prisma/migrations/202602242355_step7_sms/migration.sql`
5. Start all apps and server:
   ```bash
   pnpm dev
   ```
6. Seed dev data (optional, recommended for QA):
   ```bash
   pnpm --filter @pmm/server seed
   ```
7. Remove seeded/mock admin data:
   ```bash
   pnpm --filter @pmm/server cleanup:mock
   ```

## Per-App Dev Commands
- Server: `pnpm --filter @pmm/server dev`
- Admin app: `pnpm --filter @pmm/admin dev`
- Widget app: `pnpm --filter @pmm/widget dev`
- Advisor app: `pnpm --filter @pmm/advisor dev`

## App URLs
- Admin: `http://localhost:5173`
- Widget: `http://localhost:5174/widget`
- Advisor: `http://localhost:5175`
- Server health: `http://localhost:4000/health`

## Voice NOW Flow
1. Candidate opens `/widget`.
2. Grants microphone access.
3. Widget calls `POST /api/realtime/token` to fetch an ephemeral client secret.
4. Widget establishes WebRTC session with OpenAI Realtime API.
5. Transcript events are shown live and posted to server.
6. Session completion is persisted.

## Widget Modes (Step 3)
- Mode select: Voice, Chat, Quiz (`/widget`).
- Optional query params:
  - `?mode=voice|chat|quiz` preselects mode (and locks it).
  - `?lockMode=1` or `?lockMode=true` locks selector.
  - `?programId=<id>` preselects and hides program selector.
- Results page: `/widget/results`.
- Results lead capture: `Request Info / Talk to an advisor` posts to `POST /api/public/leads`.

## API Endpoints
- `POST /api/realtime/token`: mints ephemeral realtime session secret using `OPENAI_API_KEY`.
- `POST /api/sessions`: create a `CandidateSession` in `active` state.
- `POST /api/sessions/:id/transcript`: append transcript turns.
- `POST /api/sessions/:id/complete`: mark session complete and set `endedAt`.
- `POST /api/sessions/:id/score`: score and persist a scorecard for `chat` or `quiz`.
- `GET/POST /api/admin/traits`
- `GET/PUT/DELETE /api/admin/traits/:id`
- `GET/POST /api/admin/traits/:id/questions`
- `PUT/DELETE /api/admin/questions/:questionId`
- `GET/POST /api/admin/programs`
- `GET/PUT/DELETE /api/admin/programs/:id`
- `GET/PUT /api/admin/programs/:id/traits`
- `GET/POST /api/admin/brand-voices`
- `PUT/DELETE /api/admin/brand-voices/:id`
- `GET /api/public/programs`
- `GET /api/public/programs/:id`
- `GET /api/public/programs/:id/questions?type=chat|quiz`
- `POST /api/public/leads`
- `GET /api/advisor/programs`
- `GET /api/advisor/leads`
- `GET /api/advisor/leads/:id`
- `PUT /api/advisor/leads/:id`
- `POST /api/phone/calls`
- `POST /api/phone/twilio/voice`
- `POST /api/phone/twilio/status`
- `WSS /api/phone/twilio/stream`
- `POST /api/sms/start`
- `POST /api/sms/send`
- `POST /api/sms/twilio/inbound`
- `POST /api/sms/twilio/status`

## Hardening Notes (Step 5)
- Error shape standardized as `{ error: { code, message, details? } }`.
- Request IDs are accepted/returned via `x-request-id`.
- Structured JSON logging is enabled with PII masking for email/phone.
- Public rate limits applied to:
  - `POST /api/realtime/token`
  - `POST /api/public/leads`
  - `POST /api/sessions/:id/score`
- OpenAI outbound calls use timeout + retry policy.
- Simple operational counters logged for session/scoring/token events.

## Telephony Notes (Step 6)
- Outbound PSTN calling uses Twilio REST API and Twilio Voice webhooks.
- Phone adapter boundary:
  - `server/src/phone/TwilioVoiceAdapter.ts` (provider client)
  - `server/src/phone/TelephonyRealtimeBridge.ts` (call stream + transcript persistence)
  - `server/src/phone/index.ts` (routes + webhook/ws wiring)
- `CandidateSession.channel` distinguishes web vs phone channels.
- `CallSession` tracks provider IDs/status transitions and links to `CandidateSession` + `Lead`.
- On Twilio `completed` status callback:
  - call/session are finalized
  - scorecard generation runs through the shared chat scoring pipeline when transcript + program are present
  - scoring failure is recorded in `CallSession.failureReason`

## Twilio Local Setup (ngrok)
1. Start server:
   ```bash
   pnpm --filter @pmm/server dev
   ```
2. Start tunnel:
   ```bash
   ngrok http 4000
   ```
3. Set `.env`:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_NUMBER`
   - `TWILIO_MESSAGING_SERVICE_SID` (optional alternative to `TWILIO_FROM_NUMBER`)
   - `TWILIO_WEBHOOK_BASE_URL=https://<your-ngrok-host>`
   - `TWILIO_WEBHOOK_AUTH_SECRET=<shared-secret>`
4. Start apps:
   ```bash
   pnpm dev
   ```
5. From Advisor Lead Detail, click `Call candidate`, confirm number, and start call.
6. Observe call status updates in lead detail; transcript + scorecard populate after completion.

## SMS Notes (Step 7)
- SMS module boundary:
  - `server/src/sms/TwilioSmsAdapter.ts` (provider client)
  - `server/src/sms/state.ts` (keyword + interview step state machine)
  - `server/src/sms/index.ts` (routes/webhooks and persistence)
- Advisor Lead Detail includes:
  - `Start SMS interview`
  - SMS thread (inbound/outbound + status)
  - ad-hoc 1:1 send box via `POST /api/sms/send`
- STOP/UNSUBSCRIBE/CANCEL/END/QUIT set session status `OPTED_OUT` and block outbound sends.
- START reactivates opted-out sessions.
- Interview completion triggers chat-style scoring from persisted transcript turns and stores `Scorecard`.

## Twilio SMS Webhooks (ngrok)
1. In Twilio Messaging webhook config:
   - Incoming message URL: `https://<ngrok-host>/api/sms/twilio/inbound?token=<TWILIO_WEBHOOK_AUTH_SECRET>`
   - Status callback URL: `https://<ngrok-host>/api/sms/twilio/status?token=<TWILIO_WEBHOOK_AUTH_SECRET>`
2. Start interview from Advisor Lead Detail or call `POST /api/sms/start`.
3. Reply to incoming prompts from your test phone number.
4. Verify lead detail updates:
   - SMS thread messages persist
   - session moves to completed
   - scorecard appears after final reply

## Quality Gate
- Run all pilot-readiness checks locally:
  ```bash
  pnpm check
  ```

## Data Model
- `CandidateSession { id, mode, status, startedAt, endedAt }`
- `TranscriptTurn { id, sessionId, ts, speaker, text }`
- `Trait { id, name, category, definition, rubricScaleMin, rubricScaleMax, rubricPositiveSignals, rubricNegativeSignals, rubricFollowUps, createdAt, updatedAt }`
- `TraitQuestion { id, traitId, type, prompt, optionsJson, scoringHints, createdAt, updatedAt }`
- `Program { id, name, description, degreeLevel, department, createdAt, updatedAt }`
- `ProgramTrait { id, programId, traitId, bucket, sortOrder, notes }`
- `BrandVoice { id, name, tonePreset, doList, dontList, samplePhrases, createdAt, updatedAt }`
- `Scorecard { id, sessionId, programId, overallScore, createdAt }`
- `TraitScore { id, scorecardId, traitId, bucket, score0to5, confidence, evidenceJson }`
- `Candidate { id, firstName, lastName, email, phone, preferredChannel, createdAt, updatedAt }`
- `Lead { id, candidateId, programId, source, status, owner, notes, lastContactedAt, createdAt, updatedAt }`

## Next Bet Placement
- Traits/Programs/BrandVoice domain shapes: `packages/domain/src/index.ts`
- Admin management views: `apps/admin/src/main.tsx` (split into routes/components next)
- Future scoring implementation: `packages/domain/src/index.ts` (`scoreCandidateSession`)
