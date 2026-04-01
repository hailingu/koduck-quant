-- V26: Cleanup memory_l2_themes table - remove deprecated fields
-- Issue: Clean up redundant fields after V2 architecture simplification

-- Step 1: Backup existing data (optional safety)
-- CREATE TABLE IF NOT EXISTS memory_l2_themes_backup AS SELECT * FROM memory_l2_themes;

-- Step 2: Rename and consolidate fields
-- Merge aggregated_summary and theme_description into summary, then rename to description
ALTER TABLE memory_l2_themes 
    ADD COLUMN IF NOT EXISTS description TEXT;

-- Migrate data with runtime column-existence checks
DO $$
DECLARE
    has_aggregated_summary BOOLEAN;
    has_theme_description BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'memory_l2_themes'
          AND column_name = 'aggregated_summary'
    ) INTO has_aggregated_summary;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'memory_l2_themes'
          AND column_name = 'theme_description'
    ) INTO has_theme_description;

    IF has_aggregated_summary AND has_theme_description THEN
        EXECUTE $sql$
            UPDATE memory_l2_themes
            SET description = COALESCE(aggregated_summary, theme_description, '')
            WHERE description IS NULL OR description = ''
        $sql$;
    ELSIF has_aggregated_summary THEN
        EXECUTE $sql$
            UPDATE memory_l2_themes
            SET description = COALESCE(aggregated_summary, '')
            WHERE description IS NULL OR description = ''
        $sql$;
    ELSIF has_theme_description THEN
        EXECUTE $sql$
            UPDATE memory_l2_themes
            SET description = COALESCE(theme_description, '')
            WHERE description IS NULL OR description = ''
        $sql$;
    ELSE
        EXECUTE $sql$
            UPDATE memory_l2_themes
            SET description = ''
            WHERE description IS NULL
        $sql$;
    END IF;
END
$$;

-- Step 3: Merge related_keywords into keywords
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'memory_l2_themes'
          AND column_name = 'related_keywords'
    ) THEN
        EXECUTE $sql$
            UPDATE memory_l2_themes
            SET keywords = array_cat(keywords, related_keywords)
            WHERE related_keywords IS NOT NULL
              AND array_length(related_keywords, 1) > 0
        $sql$;
    END IF;
END
$$;

-- Deduplicate keywords after merge
UPDATE memory_l2_themes 
SET keywords = ARRAY(
    SELECT DISTINCT unnest(keywords)
    LIMIT 20
);

-- Step 4: Rename first_seen_at to created_at
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'memory_l2_themes'
          AND column_name = 'first_seen_at'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'memory_l2_themes'
          AND column_name = 'created_at'
    ) THEN
        ALTER TABLE memory_l2_themes RENAME COLUMN first_seen_at TO created_at;
    END IF;
END
$$;

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
