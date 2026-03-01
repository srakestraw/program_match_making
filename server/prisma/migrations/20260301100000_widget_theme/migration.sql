-- CreateEnum
CREATE TYPE "WidgetThemeStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- CreateEnum
CREATE TYPE "WidgetThemeSource" AS ENUM ('MANUAL', 'URL_SCRAPE', 'PRESET');

-- CreateTable
CREATE TABLE "WidgetTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WidgetThemeStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "WidgetThemeSource" NOT NULL DEFAULT 'MANUAL',
    "sourceUrl" TEXT,
    "tokens" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WidgetTheme_status_updatedAt_idx" ON "WidgetTheme"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "WidgetTheme_source_updatedAt_idx" ON "WidgetTheme"("source", "updatedAt");
