DROP INDEX IF EXISTS idx_memory_index_records_memory_unit_id;

ALTER TABLE memory_index_records
    DROP COLUMN IF EXISTS memory_unit_id;
