-- CreateEnum
CREATE TYPE "TraitAnswerStyle" AS ENUM ('RADIO', 'CARD_GRID', 'SLIDER', 'CHAT');

-- CreateEnum
CREATE TYPE "TraitVisualMood" AS ENUM ('NEUTRAL', 'ASPIRATIONAL', 'PLAYFUL', 'BOLD', 'SERIOUS');

-- AlterTable
ALTER TABLE "Trait"
ADD COLUMN "publicLabel" TEXT,
ADD COLUMN "oneLineHook" TEXT,
ADD COLUMN "archetypeTag" TEXT,
ADD COLUMN "displayIcon" TEXT,
ADD COLUMN "visualMood" "TraitVisualMood",
ADD COLUMN "experienceDraftJson" TEXT;

-- AlterTable
ALTER TABLE "TraitQuestion"
ADD COLUMN "narrativeIntro" TEXT,
ADD COLUMN "answerStyle" "TraitAnswerStyle",
ADD COLUMN "answerOptionsMetaJson" TEXT;

-- CreateTable
CREATE TABLE "QuizExperienceConfig" (
  "id" TEXT NOT NULL,
  "headline" TEXT NOT NULL DEFAULT 'Discover your best-fit graduate path',
  "subheadline" TEXT NOT NULL DEFAULT 'A quick, personality-first quiz to see where you thrive.',
  "estimatedTimeLabel" TEXT NOT NULL DEFAULT '3-5 min',
  "tonePreset" TEXT NOT NULL DEFAULT 'GEN_Z_FRIENDLY',
  "gradientSet" TEXT NOT NULL DEFAULT 'SUNRISE',
  "motionIntensity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "rankingMotionStyle" TEXT NOT NULL DEFAULT 'SPRING',
  "revealStyle" TEXT NOT NULL DEFAULT 'IDENTITY',
  "introMediaPrompt" TEXT,
  "revealMediaPrompt" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizExperienceConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "QuizExperienceConfig" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
