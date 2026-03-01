ALTER TABLE "Program"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Program"
SET "isActive" = true;
