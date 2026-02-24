-- CreateTable
CREATE TABLE IF NOT EXISTS "CandidateSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TranscriptTurn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "ts" DATETIME NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "TranscriptTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CandidateSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Trait" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "definition" TEXT,
    "rubricScaleMin" INTEGER NOT NULL DEFAULT 0,
    "rubricScaleMax" INTEGER NOT NULL DEFAULT 5,
    "rubricPositiveSignals" TEXT,
    "rubricNegativeSignals" TEXT,
    "rubricFollowUps" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TraitQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "optionsJson" TEXT,
    "scoringHints" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TraitQuestion_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "degreeLevel" TEXT,
    "department" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProgramTrait" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "ProgramTrait_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramTrait_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BrandVoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tonePreset" TEXT NOT NULL,
    "doList" TEXT,
    "dontList" TEXT,
    "samplePhrases" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TranscriptTurn_sessionId_idx" ON "TranscriptTurn"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Trait_name_key" ON "Trait"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TraitQuestion_traitId_idx" ON "TraitQuestion"("traitId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Program_name_key" ON "Program"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProgramTrait_programId_bucket_sortOrder_idx" ON "ProgramTrait"("programId", "bucket", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProgramTrait_traitId_idx" ON "ProgramTrait"("traitId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramTrait_programId_traitId_key" ON "ProgramTrait"("programId", "traitId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BrandVoice_name_key" ON "BrandVoice"("name");

