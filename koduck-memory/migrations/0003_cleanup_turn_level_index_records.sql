-- `memory_index_records` should retain retrieval-oriented rollups, not duplicated
-- raw turn text. Historical user/assistant/session-level raw turn mirrors are
-- removed so the table only contains session summary index material.
DELETE FROM memory_index_records
WHERE memory_kind <> 'summary';
