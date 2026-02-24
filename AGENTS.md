# AGENTS.md - Program Match Making

## Purpose
- Keep changes scoped to the voice vertical slice (widget + server + persistence).
- Preserve the monorepo layout and shared package boundaries.

## Build, Dev, Test Commands
- Install deps: `pnpm install`
- Run all dev servers: `pnpm dev`
- Build everything: `pnpm build`
- Typecheck everything: `pnpm typecheck`
- Prisma generate: `pnpm db:generate`
- Prisma migrate (local SQLite): `pnpm db:migrate`

## Service Ports
- Server: `http://localhost:4000`
- Admin app: `http://localhost:5173`
- Widget app: `http://localhost:5174`
- Advisor app: `http://localhost:5175`

## Scope Rules
- `apps/widget`: candidate voice flow and session UI only.
- `apps/admin`: traits/programs/brand voice management screens.
- `apps/advisor`: candidate management UI (stub for now).
- `server`: API routes, token minting, persistence.
- `packages/domain`: types, scoring, prompt/domain logic.
- `packages/voice`: WebRTC realtime client wrapper and audio utilities.
- `packages/api-client`: typed HTTP client wrappers.
- `packages/ui`: shared UI primitives.

## File Touch Rules
- Add shared domain logic in `packages/domain` before app-local duplication.
- Keep OpenAI secret usage server-side only; never in browser code.
- Prefer adding endpoints in `server/src/routes` and compose in `server/src/index.ts`.
- Schema updates must include Prisma schema changes and migration instructions in README.
- For widget transcript behavior, update both `apps/widget` and `packages/voice` as needed.

## Guardrails
- No auth hardening in v1.
- No expansion beyond voice interview + transcript persistence.
- Keep UI changes minimal and compatible with iframe embedding for widget.
