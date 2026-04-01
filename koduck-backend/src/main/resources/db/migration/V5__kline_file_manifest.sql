-- K-line file import manifest table
-- Track imported local files by content hash for incremental startup loading.

CREATE TABLE IF NOT EXISTS kline_file_manifest (
    id BIGSERIAL PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    file_hash VARCHAR(64) NOT NULL,
    market VARCHAR(20) NOT NULL DEFAULT 'AShare',
    symbol VARCHAR(20),
    timeframe VARCHAR(10),
    record_count INTEGER NOT NULL DEFAULT 0,
    max_kline_time TIMESTAMP,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kline_file_manifest_symbol_tf
ON kline_file_manifest(symbol, timeframe);

CREATE INDEX IF NOT EXISTS idx_kline_file_manifest_imported_at
ON kline_file_manifest(imported_at DESC);
