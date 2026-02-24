-- CreateTable
CREATE TABLE IF NOT EXISTS "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "preferredChannel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "programId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'widget',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "owner" TEXT,
    "notes" TEXT,
    "lastContactedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lead_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Session relation columns
ALTER TABLE "CandidateSession" ADD COLUMN "candidateId" TEXT;
ALTER TABLE "CandidateSession" ADD COLUMN "programId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Candidate_email_idx" ON "Candidate"("email");
CREATE INDEX IF NOT EXISTS "Candidate_phone_idx" ON "Candidate"("phone");
CREATE INDEX IF NOT EXISTS "CandidateSession_candidateId_idx" ON "CandidateSession"("candidateId");
CREATE INDEX IF NOT EXISTS "CandidateSession_programId_idx" ON "CandidateSession"("programId");
CREATE INDEX IF NOT EXISTS "Lead_candidateId_idx" ON "Lead"("candidateId");
CREATE INDEX IF NOT EXISTS "Lead_programId_idx" ON "Lead"("programId");
