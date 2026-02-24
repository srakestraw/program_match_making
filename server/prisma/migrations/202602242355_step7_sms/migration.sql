-- CreateTable
CREATE TABLE "SmsSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateSessionId" TEXT NOT NULL,
    "leadId" TEXT,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "lastInboundAt" DATETIME,
    "lastOutboundAt" DATETIME,
    "optedOutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmsSession_candidateSessionId_fkey" FOREIGN KEY ("candidateSessionId") REFERENCES "CandidateSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SmsSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "smsSessionId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "twilioMessageSid" TEXT,
    "deliveryStatus" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsMessage_smsSessionId_fkey" FOREIGN KEY ("smsSessionId") REFERENCES "SmsSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
