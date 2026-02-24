-- CreateEnum
CREATE TYPE "TraitCategory" AS ENUM ('ACADEMIC', 'INTERPERSONAL', 'MOTIVATION', 'EXPERIENCE', 'LEADERSHIP', 'PROBLEM_SOLVING');

-- CreateEnum
CREATE TYPE "TraitQuestionType" AS ENUM ('CHAT', 'QUIZ');

-- CreateEnum
CREATE TYPE "ProgramTraitPriorityBucket" AS ENUM ('CRITICAL', 'VERY_IMPORTANT', 'IMPORTANT', 'NICE_TO_HAVE');

-- CreateEnum
CREATE TYPE "TonePreset" AS ENUM ('FRIENDLY', 'ENCOURAGING', 'DIRECT', 'PROFESSIONAL', 'PLAYFUL');

-- CreateEnum
CREATE TYPE "PreferredChannel" AS ENUM ('email', 'sms', 'phone');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('widget', 'import');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'APPLIED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELED');

-- CreateEnum
CREATE TYPE "CandidateSessionChannel" AS ENUM ('WEB_VOICE', 'WEB_CHAT', 'WEB_QUIZ', 'PHONE_VOICE', 'SMS');

-- CreateEnum
CREATE TYPE "SmsDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "SmsDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNDELIVERED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "SmsSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'OPTED_OUT');

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "preferredChannel" "PreferredChannel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "degreeLevel" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trait" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TraitCategory" NOT NULL,
    "definition" TEXT,
    "rubricScaleMin" INTEGER NOT NULL DEFAULT 0,
    "rubricScaleMax" INTEGER NOT NULL DEFAULT 5,
    "rubricPositiveSignals" TEXT,
    "rubricNegativeSignals" TEXT,
    "rubricFollowUps" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandVoice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tonePreset" "TonePreset" NOT NULL,
    "doList" TEXT,
    "dontList" TEXT,
    "samplePhrases" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandVoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSession" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "programId" TEXT,
    "mode" TEXT NOT NULL,
    "channel" "CandidateSessionChannel" NOT NULL DEFAULT 'WEB_VOICE',
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CandidateSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "TranscriptTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitQuestion" (
    "id" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "type" "TraitQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "optionsJson" TEXT,
    "scoringHints" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraitQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTrait" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "bucket" "ProgramTraitPriorityBucket" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ProgramTrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scorecard" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraitScore" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "bucket" "ProgramTraitPriorityBucket" NOT NULL,
    "score0to5" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidenceJson" TEXT NOT NULL,

    CONSTRAINT "TraitScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "programId" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'widget',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "owner" TEXT,
    "notes" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "candidateSessionId" TEXT NOT NULL,
    "leadId" TEXT,
    "toPhone" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "twilioCallSid" TEXT,
    "streamSid" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsSession" (
    "id" TEXT NOT NULL,
    "candidateSessionId" TEXT NOT NULL,
    "leadId" TEXT,
    "phone" TEXT NOT NULL,
    "status" "SmsSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "smsSessionId" TEXT NOT NULL,
    "direction" "SmsDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "twilioMessageSid" TEXT,
    "deliveryStatus" "SmsDeliveryStatus",
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trait_name_key" ON "Trait"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Program_name_key" ON "Program"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BrandVoice_name_key" ON "BrandVoice"("name");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_phone_idx" ON "Candidate"("phone");

-- CreateIndex
CREATE INDEX "CandidateSession_candidateId_idx" ON "CandidateSession"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateSession_programId_idx" ON "CandidateSession"("programId");

-- CreateIndex
CREATE INDEX "TranscriptTurn_sessionId_idx" ON "TranscriptTurn"("sessionId");

-- CreateIndex
CREATE INDEX "TraitQuestion_traitId_idx" ON "TraitQuestion"("traitId");

-- CreateIndex
CREATE INDEX "ProgramTrait_programId_bucket_sortOrder_idx" ON "ProgramTrait"("programId", "bucket", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramTrait_traitId_idx" ON "ProgramTrait"("traitId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTrait_programId_traitId_key" ON "ProgramTrait"("programId", "traitId");

-- CreateIndex
CREATE INDEX "Scorecard_sessionId_idx" ON "Scorecard"("sessionId");

-- CreateIndex
CREATE INDEX "Scorecard_programId_idx" ON "Scorecard"("programId");

-- CreateIndex
CREATE INDEX "TraitScore_scorecardId_idx" ON "TraitScore"("scorecardId");

-- CreateIndex
CREATE INDEX "TraitScore_traitId_idx" ON "TraitScore"("traitId");

-- CreateIndex
CREATE INDEX "Lead_candidateId_idx" ON "Lead"("candidateId");

-- CreateIndex
CREATE INDEX "Lead_programId_idx" ON "Lead"("programId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CallSession_twilioCallSid_key" ON "CallSession"("twilioCallSid");

-- CreateIndex
CREATE INDEX "CallSession_candidateSessionId_idx" ON "CallSession"("candidateSessionId");

-- CreateIndex
CREATE INDEX "CallSession_leadId_idx" ON "CallSession"("leadId");

-- CreateIndex
CREATE INDEX "CallSession_status_idx" ON "CallSession"("status");

-- CreateIndex
CREATE INDEX "SmsSession_candidateSessionId_idx" ON "SmsSession"("candidateSessionId");

-- CreateIndex
CREATE INDEX "SmsSession_leadId_idx" ON "SmsSession"("leadId");

-- CreateIndex
CREATE INDEX "SmsSession_phone_idx" ON "SmsSession"("phone");

-- CreateIndex
CREATE INDEX "SmsSession_status_idx" ON "SmsSession"("status");

-- CreateIndex
CREATE INDEX "SmsMessage_smsSessionId_idx" ON "SmsMessage"("smsSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsMessage_twilioMessageSid_key" ON "SmsMessage"("twilioMessageSid");

-- AddForeignKey
ALTER TABLE "CandidateSession" ADD CONSTRAINT "CandidateSession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSession" ADD CONSTRAINT "CandidateSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptTurn" ADD CONSTRAINT "TranscriptTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CandidateSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitQuestion" ADD CONSTRAINT "TraitQuestion_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTrait" ADD CONSTRAINT "ProgramTrait_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTrait" ADD CONSTRAINT "ProgramTrait_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scorecard" ADD CONSTRAINT "Scorecard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CandidateSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scorecard" ADD CONSTRAINT "Scorecard_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitScore" ADD CONSTRAINT "TraitScore_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "Scorecard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraitScore" ADD CONSTRAINT "TraitScore_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "Trait"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_candidateSessionId_fkey" FOREIGN KEY ("candidateSessionId") REFERENCES "CandidateSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsSession" ADD CONSTRAINT "SmsSession_candidateSessionId_fkey" FOREIGN KEY ("candidateSessionId") REFERENCES "CandidateSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsSession" ADD CONSTRAINT "SmsSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_smsSessionId_fkey" FOREIGN KEY ("smsSessionId") REFERENCES "SmsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
