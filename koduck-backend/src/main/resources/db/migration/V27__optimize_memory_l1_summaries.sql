-- V27: Optimize memory_l1_summaries table structure
-- Simplify fields based on方案2 (平衡版)

DO $$
DECLARE
    has_table BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'memory_l1_summaries'
    ) INTO has_table;

    IF NOT has_table THEN
        RAISE NOTICE 'Skip V27: table memory_l1_summaries does not exist';
        RETURN;
    END IF;

    -- Step 1: Add new columns
    ALTER TABLE IF EXISTS memory_l1_summaries
        ADD COLUMN IF NOT EXISTS highlights TEXT[],
        ADD COLUMN IF NOT EXISTS value_factors JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS tags TEXT[];

    -- Step 2.1: Merge summary_detail into summary
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'memory_l1_summaries'
          AND column_name = 'summary_detail'
    ) THEN
        EXECUTE $sql$
            UPDATE memory_l1_summaries
            SET summary = CASE
                WHEN summary_detail IS NOT NULL AND summary_detail != ''
                    THEN summary || E'\n\n[详细]' || summary_detail
                ELSE summary
            END
            WHERE summary_detail IS NOT NULL AND summary_detail != ''
        $sql$;
    END IF;

    -- Step 2.2: Migrate key_points to highlights
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'memory_l1_summaries'
          AND column_name = 'key_points'
    ) THEN
        EXECUTE $sql$
            UPDATE memory_l1_summaries
            SET highlights = key_points
            WHERE highlights IS NULL AND key_points IS NOT NULL
        $sql$;
    END IF;

    -- Step 2.3: Build value_factors JSONB from legacy columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='value_importance'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='value_novelty'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='value_intent'
    ) THEN
        EXECUTE $sql$
            UPDATE memory_l1_summaries
            SET value_factors = jsonb_build_object(
                'importance', COALESCE(value_importance, 0),
                'novelty', COALESCE(value_novelty, 0),
                'intent', COALESCE(value_intent, 0)
            )::jsonb
            WHERE value_factors IS NULL OR value_factors = '{}'
        $sql$;
    END IF;

    -- Step 2.4: Migrate category_tags to tags
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'memory_l1_summaries'
          AND column_name = 'category_tags'
    ) THEN
        EXECUTE $sql$
            UPDATE memory_l1_summaries
            SET tags = category_tags
            WHERE tags IS NULL AND category_tags IS NOT NULL
        $sql$;
    END IF;

    -- Step 3: Drop deprecated columns
    ALTER TABLE IF EXISTS memory_l1_summaries
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

    -- Step 4: Set defaults only for existing columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='highlights') THEN
        ALTER TABLE memory_l1_summaries ALTER COLUMN highlights SET DEFAULT '{}';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='value_factors') THEN
        ALTER TABLE memory_l1_summaries ALTER COLUMN value_factors SET DEFAULT '{}';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='tags') THEN
        ALTER TABLE memory_l1_summaries ALTER COLUMN tags SET DEFAULT '{}';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='extracted_entities') THEN
        ALTER TABLE memory_l1_summaries ALTER COLUMN extracted_entities SET DEFAULT '[]';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='meta') THEN
        ALTER TABLE memory_l1_summaries ALTER COLUMN meta SET DEFAULT '{}';
    END IF;

    -- Step 5: Comments
    COMMENT ON TABLE memory_l1_summaries IS 'Memory System V2: L1 Session Summaries';
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='summary') THEN
        COMMENT ON COLUMN memory_l1_summaries.summary IS 'Core summary content (merged from summary + summary_detail + chat_digest)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='highlights') THEN
        COMMENT ON COLUMN memory_l1_summaries.highlights IS 'Key points/highlights extracted from conversation';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='value_factors') THEN
        COMMENT ON COLUMN memory_l1_summaries.value_factors IS 'JSON object with importance, novelty, intent scores';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='tags') THEN
        COMMENT ON COLUMN memory_l1_summaries.tags IS 'Category tags for classification';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='extracted_entities') THEN
        COMMENT ON COLUMN memory_l1_summaries.extracted_entities IS 'JSON array of extracted entities';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memory_l1_summaries' AND column_name='meta') THEN
        COMMENT ON COLUMN memory_l1_summaries.meta IS 'Additional metadata (JSONB)';
    END IF;
END
$$;
