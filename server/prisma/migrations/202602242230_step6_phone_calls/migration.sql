-- CreateTable
CREATE TABLE IF NOT EXISTS "CallSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateSessionId" TEXT NOT NULL,
    "leadId" TEXT,
    "toPhone" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "twilioCallSid" TEXT,
    "streamSid" TEXT,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CallSession_candidateSessionId_fkey" FOREIGN KEY ("candidateSessionId") REFERENCES "CandidateSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CallSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CandidateSession channel column
ALTER TABLE "CandidateSession" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'WEB_VOICE';

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "CallSession_twilioCallSid_key" ON "CallSession"("twilioCallSid");
CREATE INDEX IF NOT EXISTS "CallSession_candidateSessionId_idx" ON "CallSession"("candidateSessionId");
CREATE INDEX IF NOT EXISTS "CallSession_leadId_idx" ON "CallSession"("leadId");
CREATE INDEX IF NOT EXISTS "CallSession_status_idx" ON "CallSession"("status");
