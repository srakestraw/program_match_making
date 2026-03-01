# Program Match Making (Monorepo)

V1 monorepo for Program Match Making with four apps and one Express server:
- Portal app (launcher for local app surfaces)
- Admin app (Traits, Programs, Brand Voice stubs)
- Widget app (Voice NOW vertical slice)
- Advisor app (candidate management stub)
- Express + Prisma + PostgreSQL (AWS RDS) backend

## Tech
- Monorepo: pnpm workspaces + Turborepo
- Frontend: React + Vite + TypeScript + Tailwind
- State: TanStack Query + Zustand
- Validation: Zod
- Backend: Node + Express + TypeScript
- Persistence: Prisma + PostgreSQL (AWS RDS)
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
3. Set `OPENAI_API_KEY` and `DATABASE_URL` in `.env`.
   - `OPENAI_API_KEY`: Used for session scoring, brand voice samples, TTS, and trait content generation (Admin “Generate with AI” and `pnpm --filter @pmm/server backfill-trait-content`).
   - `DATABASE_URL`: RDS PostgreSQL connection string (see `.env.example` for format)
   - Optional hardening env vars:
   - `WIDGET_ALLOWED_ORIGINS` (comma-separated origins)
   - `JSON_BODY_LIMIT` (default `100kb`)
   - `PUBLIC_RATE_LIMIT_WINDOW_MS`, `PUBLIC_RATE_LIMIT_TOKEN_MAX`, `PUBLIC_RATE_LIMIT_LEAD_MAX`, `PUBLIC_RATE_LIMIT_SCORE_MAX`
   - `OPENAI_TIMEOUT_MS`, `OPENAI_MAX_RETRIES`
   - `LOG_LEVEL`
4. Generate Prisma client and apply migrations:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```
   `db:migrate` runs `prisma migrate deploy` against the database in `DATABASE_URL`.
   Ensure `server/.env` or root `.env` has `DATABASE_URL` set (RDS PostgreSQL).
   Latest schema updates include:
   - live trait scoring metadata columns (`traitQuestionId`, `rationale`, `scoredAt`) on `TraitScore`
   - session-level trait persistence table `CandidateTraitScore` for adaptive multi-program ranking
   - BrandVoice fields (`primaryTone`, `ttsVoiceName`, `toneModifiers`, `toneProfile`, `styleFlags`, `avoidFlags`, `canonicalExamples`)
   - Simulation Lab persistence (`ConversationScenario`, `ConversationSimulation`, `ConversationTurn`, `VoiceSample`) and enums
   - Program activation status: `Program.isActive` (new rows default `false`; migration backfills existing rows to `true`)
   - Widget branding persistence: `WidgetTheme` with draft/active status, source metadata, and token JSON
5. Start all apps and server:
   ```bash
   pnpm dev
   ```
6. Database seeding is disabled. Create traits, programs, and brand voices via the Admin app. To clear all data and start from scratch: `pnpm --filter @pmm/server reset-seed-data`. To create the GSU Graduate School brand voice: `pnpm --filter @pmm/server seed:gsu-voice`.
7. Remove seeded/mock admin data:
   ```bash
   pnpm --filter @pmm/server cleanup:mock
   ```

## AWS RDS (Prototype)

The prototype uses a single RDS PostgreSQL instance for dev and production. Credentials are in `.env` (gitignored).

- **Instance**: `pmm-postgres` (db.t3.micro, PostgreSQL 16)
- **Database**: `pmm`
- **Endpoint**: `pmm-postgres.c6lasiyg653o.us-east-1.rds.amazonaws.com:5432`

To create a new RDS instance via AWS CLI (security group, subnet group, and instance), see the setup that was used. Ensure `DATABASE_URL` in `.env` and `server/.env` matches your instance.

## Production domain (single)

We use **one** custom production domain: **`https://program.gravytylabs.com`** for the **candidate widget** only. Admin and Advisor apps are not on custom domains (they run on localhost in dev or on whatever host you deploy them to; no `admin.gravytylabs.com` or `advisor.gravytylabs.com`).

**Cleanup:** If you previously had three subdomains (admin, candidate/widget, advisor), keep only the widget mapping in Route 53 and Amplify:

- **Route 53:** Keep a single CNAME: `program.gravytylabs.com` → your Amplify/CloudFront target (e.g. `d29mq7u1v3ysam.cloudfront.net`). Remove any CNAME or A records for `admin.gravytylabs.com` and `advisor.gravytylabs.com` if they exist.
- **Amplify:** Only the widget app uses a custom domain; ensure only one domain association (e.g. `gravytylabs.com` with subdomain `program` → branch `main`). Remove any other domain associations or Amplify apps for admin/advisor if you had them.
- **Server CORS:** Set `WIDGET_ALLOWED_ORIGINS` in production to include `https://program.gravytylabs.com` and the origin of any page that embeds the widget (see `.env.example`).

## Deploy widget to Amplify + custom domain (CLI)

Deploy the widget app to AWS Amplify and add custom domain `program.gravytylabs.com` (CNAME in Route 53). Prerequisites: **AWS CLI** configured, **pnpm**, **curl**, **jq**. DNS for `gravytylabs.com` must be in Route 53.

```bash
./scripts/deploy-amplify.sh
```

The script will:

1. Create an Amplify app (or reuse existing `pmm-widget`), create branch `main` if needed.
2. Build the widget, zip `apps/widget/dist`, and deploy via Amplify manual deployment APIs.
3. Associate domain `gravytylabs.com` with subdomain `program` → branch `main`.
4. Look up the Route 53 hosted zone for `gravytylabs.com` and add a **CNAME** record: `program.gravytylabs.com` → Amplify’s target.

Optional env vars:

- `VITE_API_URL` – **required for production.** Your server’s public URL (e.g. `https://api.gravytylabs.com`). The widget is built with this as the API base; if unset it defaults to `http://localhost:4000`, so the deployed widget will load but token/session/voice calls will fail.
- `APP_ID` – use existing Amplify app id (skips create).
- `HOSTED_ZONE_ID` – use existing Route 53 hosted zone id (skips lookup).
- `APP_NAME`, `BRANCH_NAME`, `DOMAIN_ROOT`, `SUBDOMAIN_PREFIX` – override defaults. We only use one subdomain: `program` (do not add admin/advisor subdomains).

After running, wait for the Amplify job to complete and for DNS/SSL propagation; then `https://program.gravytylabs.com` will serve the widget. To have the Admin app’s embed page show this URL in snippets, build admin with `VITE_WIDGET_URL=https://program.gravytylabs.com`.

### Troubleshooting: “Site can’t be reached”

1. **Check DNS** – Confirm `program.gravytylabs.com` resolves and points to Amplify:
   ```bash
   dig program.gravytylabs.com +short
   # or: nslookup program.gravytylabs.com
   ```
   You should see a CNAME (e.g. `xxx.cloudfront.net` or Amplify’s target). If it’s empty or wrong, fix the CNAME in **Route53** (or re-run the deploy script so it re-upserts the record). DNS for gravytylabs.com is in Route53; `program.gravytylabs.com` should point to the Amplify/CloudFront target (e.g. `d29mq7u1v3ysam.cloudfront.net`).

2. **Check Amplify job** – In [Amplify Console](https://console.aws.amazon.com/amplify/) → your app → **main** branch, ensure the last job **Succeeded**. If it failed, fix the build and redeploy (re-run `./scripts/deploy-amplify.sh`).

3. **Try the default branch URL** – If the custom domain fails, open the branch URL directly (replace `APP_ID` with your app id, e.g. from `aws amplify list-apps`):
   ```text
   https://main.<APP_ID>.amplifyapp.com
   ```
   If this works but `https://program.gravytylabs.com` does not, the issue is DNS or domain association, not the deployment.

5. **Widget loads but “doesn’t work” (no voice, session, or errors in console)** – The widget was built without a production API URL, so it calls `http://localhost:4000`. Redeploy with your server’s public URL: `VITE_API_URL=https://your-server.com ./scripts/deploy-amplify.sh`. Also set `WIDGET_ALLOWED_ORIGINS` on the server to include `https://main.<APP_ID>.amplifyapp.com` and `https://program.gravytylabs.com`.

4. **Check domain association** – Custom domain must be **Available** and subdomain **Verified**:
   ```bash
   aws amplify get-domain-association --app-id <APP_ID> --domain-name gravytylabs.com --query 'domainAssociation.{domainStatus:domainStatus,subDomains:subDomains}'
   ```
   If `domainStatus` is not `AVAILABLE` or the `program` subdomain is not verified, wait for certificate/DNS propagation (often 5–30 min) or fix the CNAME in Route 53 to match the `dnsRecord` value Amplify shows for that subdomain.

## Per-App Dev Commands
- Server: `pnpm --filter @pmm/server dev`
- Portal app: `pnpm --filter @pmm/portal dev`
- Admin app: `pnpm --filter @pmm/admin dev`
- Widget app: `pnpm --filter @pmm/widget dev`
- Advisor app: `pnpm --filter @pmm/advisor dev`

## App URLs (local dev)
- Portal: `http://localhost:3000`
- Admin: `http://localhost:5173`
- Widget: `http://localhost:5174/widget`
- Advisor: `http://localhost:5175`
- Server health: `http://localhost:4000/health`

**Production:** Only the candidate widget has a custom URL: **https://program.gravytylabs.com**. Admin and Advisor do not use custom domains.

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
  - `?programId=<id>` acts as an optional compare/filter scope (`programFilterIds=[id]`).
- Results page: `/widget/results`.
- Results lead capture: `Request Info / Talk to an advisor` posts to `POST /api/public/leads`.

## API Endpoints
- `POST /api/realtime/token`: mints ephemeral realtime session secret using `OPENAI_API_KEY`.
- `POST /api/sessions`: create a `CandidateSession` in `active` state.
- `POST /api/interview/sessions`: create session without requiring a program, returns initial prompt + ranking snapshot.
- `POST /api/interview/sessions/:id/turns`: submit candidate turn, returns updated trait snapshot, rankings, next question, and checkpoint.
- `POST /api/interview/sessions/:id/checkpoint`: handle checkpoint action (`stop|continue|focus`) and return next state.
- `POST /api/voice/session/start`: alias start endpoint with optional `scoring_snapshot` + `program_fit`.
- `POST /api/sessions/:id/transcript`: append transcript turns.
- `POST /api/sessions/:id/complete`: mark session complete and set `endedAt`.
- `POST /api/sessions/:id/score`: score and persist a scorecard for `chat` or `quiz`.
- `POST /api/voice/session/turn`: alias turn-scoring endpoint (returns `scoring_snapshot` + `program_fit`).
- `POST /api/voice/session/end`: alias end endpoint with final `scoring_snapshot` + `program_fit`.
- `GET/POST /api/admin/traits`
- `GET/PUT/DELETE /api/admin/traits/:id`
- `GET/POST /api/admin/traits/:id/questions`
- `PUT/DELETE /api/admin/questions/:questionId`
- `GET/POST /api/admin/programs`
- `GET/PATCH/PUT/DELETE /api/admin/programs/:id`
- `PATCH /api/admin/programs/:id/status`
- `GET/PUT /api/admin/programs/:id/traits`
- `GET/POST /api/admin/brand-voices`
- `PUT/DELETE /api/admin/brand-voices/:id`
- `POST /api/admin/brand-voices/:id/generate-samples`
- `GET /api/admin/widget-theme`
- `POST /api/admin/widget-theme`
- `POST /api/admin/widget-theme/scrape`
- `POST /api/admin/widget-theme/activate`
- `GET /api/admin/simulation-scenarios`
- `POST /api/admin/brand-voices/:id/simulations`
- `POST /api/admin/simulations/:id/turns`
- `POST /api/admin/simulations/:id/voice-samples`
- `POST /api/admin/simulations/:id/pressure-test`
- `GET /api/public/programs`
- `GET /api/public/programs/:id`
- `GET /api/public/programs/:id/questions?type=chat|quiz`
- `GET /api/public/widget-theme?theme=active|draft`
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
- **Traits & Programs** — [Full doc](docs/trait-and-program-data-model.md): `Trait`, `TraitQuestion`, `Program`, `ProgramTrait`; enums `TraitCategory`, `ProgramTraitPriorityBucket`, `TraitQuestionType`; domain types and scoring/ranking usage.
- `CandidateSession { id, mode, status, startedAt, endedAt }`
- `TranscriptTurn { id, sessionId, ts, speaker, text }`
- `Trait { id, name, category, definition, rubricScaleMin, rubricScaleMax, rubricPositiveSignals, rubricNegativeSignals, rubricFollowUps, createdAt, updatedAt }`
- `TraitQuestion { id, traitId, type, prompt, optionsJson, createdAt, updatedAt }`
- `Program { id, name, description, degreeLevel, department, isActive, createdAt, updatedAt }`
- `ProgramTrait { id, programId, traitId, bucket, sortOrder, notes }`
- `BrandVoice` — [Full doc](docs/brand-voice-data-model.md): `id`, `name`, `primaryTone`, `ttsVoiceName`, `toneModifiers[]`, `toneProfile` (json), `styleFlags[]`, `avoidFlags[]`, `canonicalExamples` (json), `createdAt`, `updatedAt`
- `ConversationScenario { id, title, stage, persona?, seedPrompt, isPreset, createdAt, updatedAt }`
- `ConversationSimulation { id, brandVoiceId, scenarioId?, persona, customScenario?, stabilityScore?, createdAt }`
- `ConversationTurn { id, simulationId, role, content, order, createdAt }`
- `VoiceSample { id, simulationId, turnId, provider, voiceName?, audioUrl, createdAt }`
- `Scorecard { id, sessionId, programId, overallScore, createdAt }`
- `TraitScore { id, scorecardId, traitId, bucket, score0to5, confidence, evidenceJson }`
- `TraitScore { id, scorecardId, traitId, traitQuestionId, bucket, score0to5, confidence, evidenceJson, rationale, scoredAt, createdAt, updatedAt }`
- `Candidate { id, firstName, lastName, email, phone, preferredChannel, createdAt, updatedAt }`
- `Lead { id, candidateId, programId, source, status, owner, notes, lastContactedAt, createdAt, updatedAt }`

### Scoring Mental Model
- Trait owns scoring criteria: trait definition + rubric positive/negative signals drive evaluation.
- Questions elicit evidence only; question-level scoring guidance is intentionally removed.

## Next Bet Placement
- Traits/Programs/BrandVoice domain shapes: `packages/domain/src/index.ts`
- Admin management views: `apps/admin/src/main.tsx` (split into routes/components next)
- Future scoring implementation: `packages/domain/src/index.ts` (`scoreCandidateSession`)
