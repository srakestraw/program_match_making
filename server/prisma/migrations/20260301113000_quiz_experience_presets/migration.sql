-- CreateEnum
CREATE TYPE "QuizExperiencePreset" AS ENUM (
  'ADMISSIONS_MARKETING',
  'EXECUTIVE_MBA',
  'GEN_Z_SOCIAL',
  'TRADITIONAL_ACADEMIC',
  'EXPERIMENTAL_AI'
);

-- AlterTable
ALTER TABLE "QuizExperienceConfig"
  ADD COLUMN "experiencePreset" "QuizExperiencePreset",
  ADD COLUMN "experienceOverrides" JSONB;
