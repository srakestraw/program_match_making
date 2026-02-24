-- CreateEnum
CREATE TYPE "ConversationScenarioStage" AS ENUM ('AWARENESS', 'CONSIDERATION', 'OBJECTION');

-- CreateEnum
CREATE TYPE "ConversationPersona" AS ENUM ('STUDENT', 'PARENT', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "ConversationTurnRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "ConversationScenario" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "stage" "ConversationScenarioStage" NOT NULL,
  "persona" "ConversationPersona",
  "seedPrompt" TEXT NOT NULL,
  "isPreset" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConversationScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSimulation" (
  "id" TEXT NOT NULL,
  "brandVoiceId" TEXT NOT NULL,
  "scenarioId" TEXT,
  "persona" "ConversationPersona" NOT NULL,
  "customScenario" TEXT,
  "stabilityScore" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTurn" (
  "id" TEXT NOT NULL,
  "simulationId" TEXT NOT NULL,
  "role" "ConversationTurnRole" NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "order" INTEGER NOT NULL,
  CONSTRAINT "ConversationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceSample" (
  "id" TEXT NOT NULL,
  "simulationId" TEXT NOT NULL,
  "turnId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stub',
  "voiceName" TEXT,
  "audioUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceSample_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ConversationSimulation_brandVoiceId_idx" ON "ConversationSimulation"("brandVoiceId");
CREATE INDEX "ConversationTurn_simulationId_order_idx" ON "ConversationTurn"("simulationId", "order");
CREATE INDEX "VoiceSample_simulationId_idx" ON "VoiceSample"("simulationId");

-- FKs
ALTER TABLE "ConversationSimulation"
  ADD CONSTRAINT "ConversationSimulation_brandVoiceId_fkey"
  FOREIGN KEY ("brandVoiceId") REFERENCES "BrandVoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationSimulation"
  ADD CONSTRAINT "ConversationSimulation_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "ConversationScenario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationTurn"
  ADD CONSTRAINT "ConversationTurn_simulationId_fkey"
  FOREIGN KEY ("simulationId") REFERENCES "ConversationSimulation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoiceSample"
  ADD CONSTRAINT "VoiceSample_simulationId_fkey"
  FOREIGN KEY ("simulationId") REFERENCES "ConversationSimulation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoiceSample"
  ADD CONSTRAINT "VoiceSample_turnId_fkey"
  FOREIGN KEY ("turnId") REFERENCES "ConversationTurn"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed preset scenarios (3 per stage)
INSERT INTO "ConversationScenario" ("id", "title", "stage", "persona", "seedPrompt", "isPreset", "createdAt", "updatedAt")
VALUES
  ('simscn_awareness_01', 'First inquiry about program fit', 'AWARENESS', NULL, 'I just found this program. Can you explain who it is best for and what outcomes graduates see?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('simscn_awareness_02', 'Working professional exploring change', 'AWARENESS', 'STUDENT', 'I work full-time and want to move into analytics. Is this realistic for someone changing careers?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('simscn_awareness_03', 'Parent asks about support', 'AWARENESS', 'PARENT', 'I am helping my student choose graduate options. What support and advising are available?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('simscn_consideration_01', 'Curriculum depth and modality', 'CONSIDERATION', 'STUDENT', 'How technical is the curriculum, and what tools or coding languages are covered in practice?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('simscn_consideration_02', 'International applicant planning', 'CONSIDERATION', 'INTERNATIONAL', 'As an international applicant, what timeline should I plan for and how can I stay on track?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('simscn_consideration_03', 'Comparing two programs', 'CONSIDERATION', NULL, 'I am comparing this program with another school. What should I evaluate when deciding?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('simscn_objection_01', 'Tuition and ROI objection', 'OBJECTION', 'PARENT', 'The tuition feels high. How do you justify the return on investment without overpromising?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('simscn_objection_02', 'Time commitment concern', 'OBJECTION', 'STUDENT', 'I am worried about balancing work, classes, and life. What does a sustainable plan look like?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('simscn_objection_03', 'Visa and career outcomes skepticism', 'OBJECTION', 'INTERNATIONAL', 'I am concerned about post-graduation career options and visa realities. How should I assess risk?', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
