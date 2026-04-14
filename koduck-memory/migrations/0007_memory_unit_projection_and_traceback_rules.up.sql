CREATE OR REPLACE FUNCTION compute_memory_unit_domain_class_primary(
    p_tenant_id VARCHAR(128),
    p_memory_unit_id UUID
)
RETURNS VARCHAR(64)
LANGUAGE sql
STABLE
AS $$
    SELECT anchor_key::VARCHAR(64)
    FROM memory_unit_anchors
    WHERE tenant_id = p_tenant_id
      AND memory_unit_id = p_memory_unit_id
      AND anchor_type = 'domain'
    ORDER BY weight DESC, anchor_key ASC
    LIMIT 1
$$;

COMMENT ON FUNCTION compute_memory_unit_domain_class_primary(VARCHAR(128), UUID) IS
    'Canonical projection algorithm for memory_units.domain_class_primary. Always select the first domain anchor ordered by weight DESC, anchor_key ASC.';

CREATE OR REPLACE FUNCTION sync_memory_unit_domain_class_primary(
    p_tenant_id VARCHAR(128),
    p_memory_unit_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE memory_units
    SET domain_class_primary = compute_memory_unit_domain_class_primary(
            p_tenant_id,
            p_memory_unit_id
        ),
        updated_at = updated_at
    WHERE tenant_id = p_tenant_id
      AND memory_unit_id = p_memory_unit_id;
END;
$$;

COMMENT ON FUNCTION sync_memory_unit_domain_class_primary(VARCHAR(128), UUID) IS
    'Shared helper for backfill, recomputation, migration, and trigger-driven projection refresh of memory_units.domain_class_primary.';

CREATE OR REPLACE FUNCTION trg_sync_memory_unit_domain_class_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.anchor_type = 'domain' THEN
            PERFORM sync_memory_unit_domain_class_primary(OLD.tenant_id, OLD.memory_unit_id);
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.anchor_type = 'domain' AND (
            OLD.memory_unit_id <> NEW.memory_unit_id
            OR OLD.tenant_id <> NEW.tenant_id
            OR NEW.anchor_type <> 'domain'
        ) THEN
            PERFORM sync_memory_unit_domain_class_primary(OLD.tenant_id, OLD.memory_unit_id);
        END IF;
    END IF;

    IF NEW.anchor_type = 'domain' THEN
        PERFORM sync_memory_unit_domain_class_primary(NEW.tenant_id, NEW.memory_unit_id);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_memory_unit_anchors_sync_domain_projection
    AFTER INSERT OR UPDATE OR DELETE ON memory_unit_anchors
    FOR EACH ROW
    EXECUTE FUNCTION trg_sync_memory_unit_domain_class_primary();

ALTER TABLE memory_units
    ADD CONSTRAINT chk_memory_units_source_uri_not_blank
        CHECK (BTRIM(source_uri) <> '');

COMMENT ON COLUMN memory_units.domain_class_primary IS
    'Projection field derived from domain anchors only. Use compute_memory_unit_domain_class_primary() and order domain anchors by weight DESC, anchor_key ASC.';

COMMENT ON COLUMN memory_units.source_uri IS
    'Primary trace-back URI for every unit. Single-entry units may resolve directly from source_uri; multi-entry units must combine source_uri with entry_range_start and entry_range_end for full replay.';

COMMENT ON COLUMN memory_units.entry_range_start IS
    'Inclusive starting memory_entries.sequence_num covered by this unit. For multi-entry units, complete replay requires the full entry range plus source_uri.';

COMMENT ON COLUMN memory_units.entry_range_end IS
    'Inclusive ending memory_entries.sequence_num covered by this unit. Equal to entry_range_start for single-entry units.';
