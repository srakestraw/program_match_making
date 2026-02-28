# Voice (OpenAI TTS) Implementation

This doc describes how OpenAI voice is used in the app and where the voice setting is stored.

## Overview

The codebase uses OpenAI voice in two ways:

1. **TTS (text-to-speech)** — `POST /v1/audio/speech`: synthesize speech from text. Used for Simulation Lab voice samples and the Admin “test voice” feature. The **voice is configurable** and stored per Brand Voice.
2. **Realtime** — `POST /v1/realtime/sessions`: live bidirectional voice (widget interview). The **voice is currently hardcoded** to `"alloy"`; it is not read from the database or session.

---

## Where the voice setting is stored

### Persistence (Prisma)

**Table:** `BrandVoice`  
**Schema:** `server/prisma/schema.prisma`

| Column         | Type     | Default   | Description                                      |
|----------------|----------|-----------|--------------------------------------------------|
| `ttsVoiceName` | `String` | `"alloy"` | OpenAI TTS voice name for this brand voice.      |

- **Allowed values (OpenAI):** `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` (see Admin UI and `openAiVoiceOptions` in `apps/admin`).
- **Used for:** Brand Voice CRUD, “test voice” endpoint, and Simulation Lab voice samples. It is **not** currently used for the widget’s live Realtime interview (see below).

**Relations:** `BrandVoice` is used by `ConversationSimulation` (Simulation Lab). There is no `Program.brandVoiceId`; the candidate voice session is not tied to a Brand Voice today.

### Defaults and validation

**Module:** `server/src/lib/brandVoice.ts`

- **`brandVoiceDefaults.ttsVoiceName`** → `"alloy"`.
- **`createBrandVoiceSchema`** / **`updateBrandVoiceSchema`**: `ttsVoiceName` is optional, string, 1–80 chars.

---

## TTS implementation (text-to-speech)

Synthesis is implemented in one place and used by admin and Simulation Lab.

### Core implementation

**File:** `server/src/lib/simulationVoice.ts`

- **`synthesizeVoiceSample({ text, voiceName? })`**
  - Calls OpenAI `POST https://api.openai.com/v1/audio/speech`.
  - **Model:** `process.env.OPENAI_TTS_MODEL` or `"gpt-4o-mini-tts"`.
  - **Voice:** `voiceName ?? defaultVoice` with `defaultVoice = "alloy"`.
  - **Output:** MP3, returned as a data URL: `data:audio/mpeg;base64,...`.
  - If `OPENAI_API_KEY` is missing or the request fails, returns a stub WAV data URL from `buildFallbackWavDataUri()`.

### Where TTS is used

1. **Admin – Test voice**  
   - **Route:** `POST /api/admin/brand-voices/test-voice`  
   - **Handler:** `server/src/routes/admin.ts` (around line 738).  
   - **Body:** `{ text, voiceName? }`. If `voiceName` is omitted, the Admin UI sends the current Brand Voice form value (e.g. `form.ttsVoiceName`).  
   - **Response:** `{ data: { provider, voiceName, audioUrl } }`.

2. **Admin – Simulation Lab voice samples**  
   - **Route:** `POST /api/admin/simulations/:id/voice-samples`  
   - **Handler:** `server/src/routes/admin.ts` (around line 924).  
   - **Voice resolution:** `body.voiceName ?? simulation.brandVoice.ttsVoiceName ?? brandVoiceDefaults.ttsVoiceName`.  
   - Creates `VoiceSample` records with `voiceName`, `provider`, `audioUrl` (and optional override per request).

So for TTS, the **stored** voice is **`BrandVoice.ttsVoiceName`** (and optional request overrides). It is persisted in the `BrandVoice` table and used whenever a simulation or test uses that brand voice.

---

## Realtime implementation (live voice interview)

The widget’s live voice uses the OpenAI Realtime API. The **assistant voice for Realtime is not read from the database**; it is fixed in server code.

### Token minting

**File:** `server/src/routes/realtime.ts`  
**Route:** `POST /api/realtime/token`

- Calls OpenAI `POST https://api.openai.com/v1/realtime/sessions`.
- **Body:** `{ model: "gpt-4o-realtime-preview", voice: "alloy" }` — **voice is hardcoded**.
- Returns the session payload (including `client_secret`) to the client. No request body or session/program context is used to choose the voice.

### Client usage

- **API client:** `packages/api-client` — `getRealtimeToken()` POSTs to `/api/realtime/token` and returns the token object (e.g. `client_secret.value`).
- **Widget:** `apps/widget/src/main.tsx` — On “Start interview”, it calls `api.getRealtimeToken()`, then connects with `RealtimeSession` from `@pmm/voice` using `token.client_secret.value`.
- **Package:** `packages/voice` — `RealtimeSession` connects to the OpenAI Realtime API (e.g. `gpt-4o-realtime-preview`). The voice is determined by the server when minting the session (currently always `"alloy"`).

So for **Realtime**, the voice setting is **not** stored anywhere in the app; it lives only in `server/src/routes/realtime.ts` as the literal `voice: "alloy"`. To make it configurable (e.g. per program or session), you’d need to resolve a Brand Voice (or similar) when minting the token and pass that voice into the Realtime session request.

---

## Summary

| Use case              | API / feature           | Where voice comes from                    | Stored in DB?        |
|-----------------------|-------------------------|------------------------------------------|----------------------|
| TTS (samples, test)   | `/v1/audio/speech`      | `BrandVoice.ttsVoiceName` or request body | Yes: `BrandVoice.ttsVoiceName` |
| Realtime (widget)     | `/v1/realtime/sessions` | Hardcoded `"alloy"` in realtime router   | No                  |

**Voice setting storage:** the only persisted voice setting is **`BrandVoice.ttsVoiceName`**. It is used for all TTS flows (test voice and Simulation Lab). The Realtime (live interview) voice is not stored; it is fixed in code.
