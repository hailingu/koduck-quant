-- V27: Optimize memory_l1_summaries table structure
-- Simplify fields based on方案2 (平衡版)

-- Step 1: Add new columns
ALTER TABLE memory_l1_summaries
    ADD COLUMN IF NOT EXISTS highlights TEXT[],
    ADD COLUMN IF NOT EXISTS value_factors JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Step 2: Migrate data
-- 2.1 Merge summary_detail and chat_digest into summary
UPDATE memory_l1_summaries 
SET summary = CASE 
    WHEN summary_detail IS NOT NULL AND summary_detail != '' 
        THEN summary || E'\n\n[详细]' || summary_detail
    ELSE summary 
END
WHERE summary_detail IS NOT NULL AND summary_detail != '';

-- 2.2 Migrate key_points to highlights
UPDATE memory_l1_summaries 
SET highlights = key_points
WHERE highlights IS NULL AND key_points IS NOT NULL;

-- 2.3 Build value_factors JSONB from individual columns
UPDATE memory_l1_summaries 
SET value_factors = jsonb_build_object(
    'importance', COALESCE(value_importance, 0),
    'novelty', COALESCE(value_novelty, 0),
    'intent', COALESCE(value_intent, 0)
)::jsonb
WHERE value_factors IS NULL OR value_factors = '{}';

-- 2.4 Migrate category_tags to tags
UPDATE memory_l1_summaries 
SET tags = category_tags
WHERE tags IS NULL AND category_tags IS NOT NULL;

-- Step 3: Drop deprecated columns
ALTER TABLE memory_l1_summaries
    DROP COLUMN IF EXISTS summary_detail,
    DROP COLUMN IF EXISTS chat_digest,
    DROP COLUMN IF EXISTS message_count,
    DROP COLUMN IF EXISTS value_importance,
    DROP COLUMN IF EXISTS value_density,
    DROP COLUMN IF EXISTS value_timeliness,
    DROP COLUMN IF EXISTS value_novelty,
    DROP COLUMN IF EXISTS value_intent,
    DROP COLUMN IF EXISTS is_auto_generated,
    DROP COLUMN IF EXISTS access_count,
    DROP COLUMN IF EXISTS last_accessed_at,
    DROP COLUMN IF EXISTS key_points,
    DROP COLUMN IF EXISTS category_tags;

-- Step 4: Set proper defaults
ALTER TABLE memory_l1_summaries
    ALTER COLUMN highlights SET DEFAULT '{}',
    ALTER COLUMN value_factors SET DEFAULT '{}',
    ALTER COLUMN tags SET DEFAULT '{}',
    ALTER COLUMN extracted_entities SET DEFAULT '[]',
    ALTER COLUMN meta SET DEFAULT '{}';

-- Step 5: Add comments for documentation
COMMENT ON TABLE memory_l1_summaries IS 'Memory System V2: L1 Session Summaries';
COMMENT ON COLUMN memory_l1_summaries.summary IS 'Core summary content (merged from summary + summary_detail + chat_digest)';
COMMENT ON COLUMN memory_l1_summaries.highlights IS 'Key points/highlights extracted from conversation';
COMMENT ON COLUMN memory_l1_summaries.value_factors IS 'JSON object with importance, novelty, intent scores';
COMMENT ON COLUMN memory_l1_summaries.tags IS 'Category tags for classification';
COMMENT ON COLUMN memory_l1_summaries.extracted_entities IS 'JSON array of extracted entities';
COMMENT ON COLUMN memory_l1_summaries.meta IS 'Additional metadata (JSONB)';
