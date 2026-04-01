package com.koduck.service;

import java.util.List;

/**
 * Service for syncing K-line data from Python Data Service.
 */
public interface KlineSyncService {

    /**
     * Sync daily K-line data for popular stocks.
     * Runs at market close (15:05) on weekdays.
     */
    void syncDailyKlineData();

    /**
     * Sync K-line data for a specific symbol.
     *
     * @param market market identifier
     * @param symbol stock symbol
     * @param timeframe K-line timeframe
     */
    void syncSymbolKline(String market, String symbol, String timeframe);

    /**
     * Asynchronously syncs a batch of symbols with a fixed interval to avoid upstream rate limiting.
     *
     * @param market market identifier
     * @param symbols symbol list to sync
     * @param timeframe K-line timeframe
     */
    void syncBatchSymbols(String market, List<String> symbols, String timeframe);

    /**
     * Request an async K-line sync with in-flight de-duplication.
     *
     * @param market market identifier
     * @param symbol stock symbol
     * @param timeframe K-line timeframe
     * @return true if a new sync task is started; false if skipped or already running
     */
    boolean requestSyncSymbolKline(String market, String symbol, String timeframe);

    /**
     * Backfill historical data for a new symbol.
     *
     * @param market market identifier
     * @param symbol stock symbol
     * @param timeframe K-line timeframe
     * @param days number of days to backfill
     */
    void backfillHistoricalData(String market, String symbol, String timeframe, int days);
}
