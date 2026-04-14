ALTER TABLE memory_summaries
    ADD COLUMN IF NOT EXISTS summary_source VARCHAR(32) NOT NULL DEFAULT 'llm',
    ADD COLUMN IF NOT EXISTS llm_error_class VARCHAR(32) NOT NULL DEFAULT 'none';

UPDATE memory_summaries
SET summary_source = 'heuristic'
WHERE summary_source = 'llm'
  AND (
    summary LIKE 'Session % summary (%'
    OR summary LIKE 'Session produced an asynchronous summary%'
  );
