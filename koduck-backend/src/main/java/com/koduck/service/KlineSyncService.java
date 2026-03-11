package com.koduck.service;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.KlineDataDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for syncing K-line data from Python Data Service.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KlineSyncService {
    
    private final RestTemplate dataServiceRestTemplate;
    private final DataServiceProperties properties;
    private final KlineService klineService;
    
    private static final String A_SHARE_BASE_PATH = "/a-share";
    private static final String DEFAULT_MARKET = "AShare";
    private static final String DEFAULT_TIMEFRAME = "1D";
    private static final long DEFAULT_BATCH_INTERVAL_MILLIS = 500L;
    private static final int DEFAULT_KLINE_QUERY_LIMIT = 1000;
    private final Set<String> inFlightSyncKeys = ConcurrentHashMap.newKeySet();
    
    /**
     * Sync daily K-line data for popular stocks.
     * Runs at market close (15:05) on weekdays.
     */
    @Scheduled(cron = "0 5 15 ? * MON-FRI", zone = "Asia/Shanghai")
    public void syncDailyKlineData() {
        log.info("Starting daily K-line data sync");
        
        // Popular A-share stocks to sync
        List<String> popularSymbols = List.of(
            "000001", // 平安银行
            "000002", // 万科A
            "000858", // 五粮液
            "002326", // 永太科技
            "600000", // 浦发银行
            "600519", // 贵州茅台
            "600036", // 招商银行
            "601318"  // 中国平安
        );
        
        for (String symbol : popularSymbols) {
            try {
                syncSymbolKlineInternal(DEFAULT_MARKET, symbol, DEFAULT_TIMEFRAME);
                // Avoid rate limiting
                Thread.sleep(1000);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                log.error("Sync interrupted", exception);
                break;
            } catch (Exception e) {
                log.error("Failed to sync {}: {}", symbol, e.getMessage());
            }
        }
        
        log.info("Daily K-line data sync completed");
    }
    
    /**
     * Sync K-line data for a specific symbol.
     */
    @Async
    public void syncSymbolKline(String market, String symbol, String timeframe) {
        syncSymbolKlineInternal(market, symbol, timeframe);
    }

    /**
     * Asynchronously syncs a batch of symbols with a fixed interval to avoid upstream rate limiting.
     *
     * @param market market identifier
     * @param symbols symbol list to sync
     * @param timeframe K-line timeframe
     */
    @Async
    public void syncBatchSymbols(String market, List<String> symbols, String timeframe) {
        Objects.requireNonNull(symbols, "symbols must not be null");
        if (symbols.isEmpty()) {
            log.warn("Batch sync skipped because symbols is empty");
            return;
        }

        log.info("Starting batch sync for {} symbols, market={}, timeframe={}", symbols.size(), market, timeframe);
        for (String symbol : symbols) {
            syncSymbolKlineInternal(market, symbol, timeframe);
            try {
                Thread.sleep(DEFAULT_BATCH_INTERVAL_MILLIS);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                log.warn("Batch sync interrupted while processing symbol={}", symbol, exception);
                break;
            }
        }
        log.info("Batch sync finished for {} symbols", symbols.size());
    }


    /**
     * Request an async K-line sync with in-flight de-duplication.
     *
     * @param market market identifier
     * @param symbol stock symbol
     * @param timeframe K-line timeframe
     * @return true if a new sync task is started; false if skipped or already running
     */
    public boolean requestSyncSymbolKline(String market, String symbol, String timeframe) {
        if (!properties.isEnabled()) {
            log.warn("Data service is disabled, skipping async sync request");
            return false;
        }

        String key = String.format("%s:%s:%s", market, symbol, timeframe);
        if (!inFlightSyncKeys.add(key)) {
            log.debug("K-line sync already in progress for key={}", key);
            return false;
        }

        CompletableFuture.runAsync(() -> {
            try {
                syncSymbolKlineInternal(market, symbol, timeframe);
            } finally {
                inFlightSyncKeys.remove(key);
            }
        });
        return true;
    }

    private void syncSymbolKlineInternal(String market, String symbol, String timeframe) {
        if (!properties.isEnabled()) {
            log.warn("Data service is disabled, skipping sync");
            return;
        }
        
        try {
            log.debug("Syncing K-line data for {}/{}/{}", market, symbol, timeframe);

            java.net.URI requestUri = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/kline")
                    .queryParam("symbol", symbol)
                    .queryParam("timeframe", timeframe)
                    .queryParam("limit", DEFAULT_KLINE_QUERY_LIMIT)
                .build(true)
                .toUri();

            RequestEntity<Void> requestEntity = RequestEntity.get(requestUri).build();
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                    dataServiceRestTemplate.exchange(
                    requestEntity,
                            new ParameterizedTypeReference<>() {}
                    );
            
            DataServiceResponse<List<Map<String, Object>>> body = response.getBody();
            if (body == null || body.data() == null) {
                log.warn("Empty response for {}/{}/{}", market, symbol, timeframe);
                return;
            }
            
            List<KlineDataDto> klineData = body.data().stream()
                    .map(this::mapToKlineDataDto)
                    .toList();
            
            klineService.saveKlineData(klineData, market, symbol, timeframe);
            log.info("Synced {} records for {}/{}/{}", klineData.size(), market, symbol, timeframe);
            
        } catch (RestClientException e) {
            log.error("Failed to sync K-line data for {}: {}", symbol, e.getMessage());
        }
    }
    
    /**
     * Backfill historical data for a new symbol.
     */
    public void backfillHistoricalData(String market, String symbol, String timeframe, int days) {
        log.info("Backfilling {} days of historical data for {}/{}/{}", days, market, symbol, timeframe);
        syncSymbolKlineInternal(market, symbol, timeframe);
    }
    
    private KlineDataDto mapToKlineDataDto(Map<String, Object> data) {
        return KlineDataDto.builder()
                .timestamp(getLong(data, "timestamp"))
                .open(getBigDecimal(data, "open"))
                .high(getBigDecimal(data, "high"))
                .low(getBigDecimal(data, "low"))
                .close(getBigDecimal(data, "close"))
                .volume(getLong(data, "volume"))
                .amount(getBigDecimal(data, "amount"))
                .build();
    }
    
    private java.math.BigDecimal getBigDecimal(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return null;
        if (value instanceof Number number) {
            return java.math.BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new java.math.BigDecimal(value.toString());
        } catch (NumberFormatException exception) {
            log.debug("Failed to parse BigDecimal for key={}", key, exception);
            return null;
        }
    }
    
    private Long getLong(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return null;
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException exception) {
            log.debug("Failed to parse Long for key={}", key, exception);
            return null;
        }
    }
}
