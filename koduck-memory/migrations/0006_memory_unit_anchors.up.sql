CREATE TABLE IF NOT EXISTS memory_unit_anchors (
    id UUID PRIMARY KEY,
    memory_unit_id UUID NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    anchor_type VARCHAR(32) NOT NULL,
    anchor_key VARCHAR(256) NOT NULL,
    anchor_value TEXT NULL,
    weight NUMERIC(5, 4) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_memory_unit_anchors_anchor_type
        CHECK (
            anchor_type IN (
                'domain',
                'entity',
                'relation',
                'discourse_action',
                'fact_type'
            )
        ),
    CONSTRAINT chk_memory_unit_anchors_weight
        CHECK (weight >= 0 AND weight <= 1)
);

CREATE INDEX IF NOT EXISTS idx_memory_unit_anchors_tenant_anchor
    ON memory_unit_anchors (tenant_id, anchor_type, anchor_key);
CREATE INDEX IF NOT EXISTS idx_memory_unit_anchors_tenant_memory_unit
    ON memory_unit_anchors (tenant_id, memory_unit_id);
CREATE INDEX IF NOT EXISTS idx_memory_unit_anchors_memory_unit_anchor_type
    ON memory_unit_anchors (memory_unit_id, anchor_type);

COMMENT ON TABLE memory_unit_anchors IS
    'Multi-anchor inverted index for memory units. V1 supports domain, entity, relation, discourse_action, and fact_type anchors only.';

COMMENT ON COLUMN memory_unit_anchors.memory_unit_id IS
    'Target memory unit referenced by this anchor row.';
COMMENT ON COLUMN memory_unit_anchors.tenant_id IS
    'Tenant boundary duplicated for efficient tenant + anchor lookups.';
COMMENT ON COLUMN memory_unit_anchors.anchor_type IS
    'Closed set for V1: domain, entity, relation, discourse_action, fact_type. No time anchor is materialized in V1.';
COMMENT ON COLUMN memory_unit_anchors.anchor_key IS
    'Normalized lookup key used by inverted-index retrieval.';
COMMENT ON COLUMN memory_unit_anchors.anchor_value IS
    'Optional canonical display value for the anchor.';
COMMENT ON COLUMN memory_unit_anchors.weight IS
    'Anchor salience used for ranking and projection, expected range is 0..1.';

CREATE OR REPLACE FUNCTION validate_memory_unit_anchor_fact_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_unit_kind VARCHAR(64);
BEGIN
    IF NEW.anchor_type <> 'fact_type' THEN
        RETURN NEW;
    END IF;

    SELECT memory_kind
    INTO target_unit_kind
    FROM memory_units
    WHERE memory_unit_id = NEW.memory_unit_id
      AND tenant_id = NEW.tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'memory_unit_anchors.fact_type requires an existing memory_units row for tenant_id=% and memory_unit_id=%',
            NEW.tenant_id,
            NEW.memory_unit_id;
    END IF;

    IF target_unit_kind <> 'fact' THEN
        RAISE EXCEPTION
            'memory_unit_anchors.fact_type requires memory_units.memory_kind=fact, got % for memory_unit_id=%',
            COALESCE(target_unit_kind, 'NULL'),
            NEW.memory_unit_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_memory_unit_anchors_validate_fact_type
    BEFORE INSERT OR UPDATE ON memory_unit_anchors
    FOR EACH ROW
    EXECUTE FUNCTION validate_memory_unit_anchor_fact_type();
