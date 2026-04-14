DROP FUNCTION IF EXISTS project_domain_class_primary(VARCHAR(128), UUID);

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
