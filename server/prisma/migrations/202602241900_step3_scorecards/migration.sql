-- CreateTable
CREATE TABLE IF NOT EXISTS "Scorecard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "overallScore" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Scorecard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CandidateSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scorecard_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TraitScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scorecardId" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "score0to5" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    CONSTRAINT "TraitScore_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "Scorecard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraitScore_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Scorecard_sessionId_idx" ON "Scorecard"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Scorecard_programId_idx" ON "Scorecard"("programId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TraitScore_scorecardId_idx" ON "TraitScore"("scorecardId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TraitScore_traitId_idx" ON "TraitScore"("traitId");
