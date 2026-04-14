ALTER TABLE memory_index_records
    ADD COLUMN IF NOT EXISTS memory_unit_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_memory_index_records_memory_unit_id
    ON memory_index_records (memory_unit_id);

COMMENT ON COLUMN memory_index_records.memory_unit_id IS
    'Compatibility mapping to memory_units.memory_unit_id. V1 summary index records point to the session-scoped summary unit; legacy entry-backed records may remain NULL or use explicit mapping rules outside this column.';
