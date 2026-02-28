CREATE TABLE "CandidateTraitScore" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "traitId" TEXT NOT NULL,
  "score0to5" DOUBLE PRECISION NOT NULL,
  "confidence0to1" DOUBLE PRECISION NOT NULL,
  "evidenceJson" TEXT NOT NULL,
  "rationale" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CandidateTraitScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateTraitScore_sessionId_traitId_key" ON "CandidateTraitScore"("sessionId", "traitId");
CREATE INDEX "CandidateTraitScore_sessionId_idx" ON "CandidateTraitScore"("sessionId");
CREATE INDEX "CandidateTraitScore_traitId_idx" ON "CandidateTraitScore"("traitId");

ALTER TABLE "CandidateTraitScore"
ADD CONSTRAINT "CandidateTraitScore_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "CandidateSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateTraitScore"
ADD CONSTRAINT "CandidateTraitScore_traitId_fkey"
FOREIGN KEY ("traitId") REFERENCES "Trait"("id") ON DELETE CASCADE ON UPDATE CASCADE;
