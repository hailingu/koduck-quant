ALTER TABLE memory_units
    DROP CONSTRAINT IF EXISTS chk_memory_units_summary_status;

ALTER TABLE memory_units
    DROP CONSTRAINT IF EXISTS chk_memory_units_summary_absent_for_non_payload_status;

ALTER TABLE memory_units
    ALTER COLUMN summary_status SET DEFAULT 'raw';

UPDATE memory_units
SET summary_status = 'ready',
    updated_at = now()
WHERE summary_status = 'pending'
  AND summary IS NOT NULL
  AND BTRIM(summary) <> '';

UPDATE memory_units
SET summary_status = CASE
        WHEN memory_kind = 'fact' THEN 'not_applicable'
        ELSE 'raw'
    END,
    summary = NULL,
    updated_at = now()
WHERE summary_status = 'pending';

ALTER TABLE memory_units
    ADD CONSTRAINT chk_memory_units_summary_status
        CHECK (summary_status IN ('raw', 'ready', 'failed', 'not_applicable', 'pending'));

ALTER TABLE memory_units
    ADD CONSTRAINT chk_memory_units_summary_absent_for_non_payload_status
        CHECK (
            summary_status NOT IN ('raw', 'not_applicable', 'pending')
            OR summary IS NULL
        );

COMMENT ON COLUMN memory_units.summary_status IS
    'Closed set: raw, ready, failed, not_applicable, pending. New writes use raw for unsummarized entry units and not_applicable for fact units; pending is retained for legacy rows only.';
