ALTER TABLE memory_units
    ADD COLUMN IF NOT EXISTS snippet TEXT NULL;

COMMENT ON COLUMN memory_units.snippet IS
    'Legacy retrieval display text. Removed from active write path; restored only for migration rollback compatibility.';
