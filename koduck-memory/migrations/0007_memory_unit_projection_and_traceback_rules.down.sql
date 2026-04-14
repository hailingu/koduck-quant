DROP TRIGGER IF EXISTS trg_memory_unit_anchors_sync_domain_projection
    ON memory_unit_anchors;
DROP FUNCTION IF EXISTS trg_sync_memory_unit_domain_class_primary();
DROP FUNCTION IF EXISTS sync_memory_unit_domain_class_primary(VARCHAR(128), UUID);
DROP FUNCTION IF EXISTS compute_memory_unit_domain_class_primary(VARCHAR(128), UUID);

ALTER TABLE memory_units
    DROP CONSTRAINT IF EXISTS chk_memory_units_source_uri_not_blank;

COMMENT ON COLUMN memory_units.domain_class_primary IS
    'Projection field derived from domain anchors, not an independent source of truth.';

COMMENT ON COLUMN memory_units.source_uri IS
    'Primary trace-back URI. Full replay for multi-entry units depends on entry_range_start and entry_range_end.';

COMMENT ON COLUMN memory_units.entry_range_start IS
    'Inclusive starting memory_entries.sequence_num covered by this unit.';

COMMENT ON COLUMN memory_units.entry_range_end IS
    'Inclusive ending memory_entries.sequence_num covered by this unit.';
