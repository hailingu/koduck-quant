DROP TRIGGER IF EXISTS trg_memory_unit_anchors_validate_fact_type
    ON memory_unit_anchors;
DROP FUNCTION IF EXISTS validate_memory_unit_anchor_fact_type();
DROP TABLE IF EXISTS memory_unit_anchors;
