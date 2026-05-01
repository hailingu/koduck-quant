ALTER TABLE memory_units
    DROP CONSTRAINT IF EXISTS chk_memory_units_summary_absent_for_non_payload_status;

ALTER TABLE memory_units
    DROP CONSTRAINT IF EXISTS chk_memory_units_summary_status;

UPDATE memory_units
SET summary_status = 'pending',
    updated_at = now()
WHERE summary_status IN ('raw', 'not_applicable');

ALTER TABLE memory_units
    ALTER COLUMN summary_status SET DEFAULT 'pending';

ALTER TABLE memory_units
    ADD CONSTRAINT chk_memory_units_summary_status
        CHECK (summary_status IN ('pending', 'ready', 'failed'));

COMMENT ON COLUMN memory_units.summary_status IS
    'Closed set: pending, ready, failed. Only ready rows may require a non-empty summary.';
