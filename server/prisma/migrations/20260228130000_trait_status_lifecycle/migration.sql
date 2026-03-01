-- CreateEnum
CREATE TYPE "TraitStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'ACTIVE', 'DEPRECATED');

-- AlterTable
ALTER TABLE "Trait" ADD COLUMN "status" "TraitStatus" NOT NULL DEFAULT 'DRAFT';
