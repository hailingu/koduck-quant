-- Remove full_name, english_name, short_name columns from stock_basic table.
-- V17 was already applied as an empty placeholder in existing local databases,
-- so the actual DDL lives in V18 to preserve Flyway checksum compatibility.

-- Drop dependent view first
DROP VIEW IF EXISTS v_stock_search;

-- Drop dependent indexes
DROP INDEX IF EXISTS idx_stock_basic_fullname_search;

-- Remove columns
ALTER TABLE stock_basic
    DROP COLUMN IF EXISTS full_name,
    DROP COLUMN IF EXISTS english_name,
    DROP COLUMN IF EXISTS short_name;