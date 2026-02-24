ALTER TABLE "BrandVoice"
ADD COLUMN "primaryTone" TEXT NOT NULL DEFAULT 'professional',
ADD COLUMN "toneModifiers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "toneProfile" JSONB NOT NULL DEFAULT '{"formality":75,"warmth":60,"directness":65,"confidence":70,"energy":55}'::jsonb,
ADD COLUMN "styleFlags" TEXT[] NOT NULL DEFAULT ARRAY['clear','credible','supportive','future_focused']::TEXT[],
ADD COLUMN "avoidFlags" TEXT[] NOT NULL DEFAULT ARRAY['jargon_heavy','overly_salesy','impersonal']::TEXT[],
ADD COLUMN "canonicalExamples" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "BrandVoice"
SET "primaryTone" = CASE "tonePreset"
  WHEN 'FRIENDLY' THEN 'friendly'
  WHEN 'ENCOURAGING' THEN 'encouraging'
  WHEN 'DIRECT' THEN 'direct'
  WHEN 'PLAYFUL' THEN 'playful'
  ELSE 'professional'
END;
