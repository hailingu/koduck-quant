-- V26: Cleanup memory_l2_themes table - remove deprecated fields
-- Issue: Clean up redundant fields after V2 architecture simplification

-- Step 1: Backup existing data (optional safety)
-- CREATE TABLE IF NOT EXISTS memory_l2_themes_backup AS SELECT * FROM memory_l2_themes;

-- Step 2: Rename and consolidate fields
-- Merge aggregated_summary and theme_description into summary, then rename to description
ALTER TABLE memory_l2_themes 
    ADD COLUMN IF NOT EXISTS description TEXT;

-- Migrate data: use aggregated_summary as description if exists, else use theme_description
UPDATE memory_l2_themes 
SET description = COALESCE(aggregated_summary, theme_description, '')
WHERE description IS NULL OR description = '';

-- Step 3: Merge related_keywords into keywords
UPDATE memory_l2_themes 
SET keywords = array_cat(keywords, related_keywords)
WHERE related_keywords IS NOT NULL AND array_length(related_keywords, 1) > 0;

-- Deduplicate keywords after merge
UPDATE memory_l2_themes 
SET keywords = ARRAY(
    SELECT DISTINCT unnest(keywords)
    LIMIT 20
);

-- Step 4: Rename first_seen_at to created_at
ALTER TABLE memory_l2_themes 
    RENAME COLUMN first_seen_at TO created_at;

-- Step 5: Drop deprecated columns
ALTER TABLE memory_l2_themes
    DROP COLUMN IF EXISTS theme_description,
    DROP COLUMN IF EXISTS aggregated_summary,
    DROP COLUMN IF EXISTS summary,
    DROP COLUMN IF EXISTS related_keywords,
    DROP COLUMN IF EXISTS page_ids,
    DROP COLUMN IF EXISTS access_count;

-- Step 6: Ensure defaults are correct
ALTER TABLE memory_l2_themes 
    ALTER COLUMN keywords SET DEFAULT '{}',
    ALTER COLUMN summary_l1_ids SET DEFAULT '{}',
    ALTER COLUMN summary_count SET DEFAULT 0,
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- Step 7: Add comment for documentation
COMMENT ON TABLE memory_l2_themes IS 'Memory System V2: L2 Themes (aggregated long-term memory)';
COMMENT ON COLUMN memory_l2_themes.description IS 'Theme description/summary aggregated from L1 summaries';
COMMENT ON COLUMN memory_l2_themes.keywords IS 'Theme keywords (merged from related_keywords)';
COMMENT ON COLUMN memory_l2_themes.summary_l1_ids IS 'IDs of related L1 summaries';
COMMENT ON COLUMN memory_l2_themes.summary_count IS 'Cached count of related L1 summaries';
