package com.koduck.service.impl;

import com.koduck.common.constants.MarketConstants;
import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.mapper.KlineDataDtoMapper;
import com.koduck.service.KlineService;
import com.koduck.service.KlineSyncService;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Implementation of KlineSyncService for syncing K-line data from Python Data Service.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
public class KlineSyncServiceImpl implements KlineSyncService {

    private final RestTemplate dataServiceRestTemplate;
    private final DataServiceProperties properties;
    private final KlineService klineService;
    private final KlineDataDtoMapper klineDataDtoMapper;

    private static final String A_SHARE_BASE_PATH = "/a-share";
    private static final String DEFAULT_MARKET = MarketConstants.DEFAULT_MARKET;
    private static final String DEFAULT_TIMEFRAME = MarketConstants.DEFAULT_TIMEFRAME;
    private static final long DEFAULT_BATCH_INTERVAL_MILLIS = 500L;
    private static final int DEFAULT_KLINE_QUERY_LIMIT = 1000;
    private static final ParameterizedTypeReference<DataServiceResponse<List<Map<String, Object>>>>
        KLINE_LIST_RESPONSE_TYPE = new ParameterizedTypeReference<>() {
        };
    private final Set<String> inFlightSyncKeys = ConcurrentHashMap.newKeySet();

    public KlineSyncServiceImpl(@Qualifier("dataServiceRestTemplate") RestTemplate dataServiceRestTemplate,
                                DataServiceProperties properties,
                                KlineService klineService,
                                KlineDataDtoMapper klineDataDtoMapper) {
        this.dataServiceRestTemplate = dataServiceRestTemplate;
        this.properties = properties;
        this.klineService = klineService;
        this.klineDataDtoMapper = klineDataDtoMapper;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Scheduled(cron = "0 5 15 ? * MON-FRI", zone = "Asia/Shanghai")
    public void syncDailyKlineData() {
        log.info("Starting daily K-line data sync");
        // Popular A-share stocks to sync
        List<String> popularSymbols = List.of(
            "000001", // 
            "000002", // A
            "000858", // 
            "002326", // 
            "600000", // 
            "600519", // 
            "600036", // 
            "601318"  // 
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
     * {@inheritDoc}
     */
    @Override
    @Async
    public void syncSymbolKline(String market, String symbol, String timeframe) {
        syncSymbolKlineInternal(market, symbol, timeframe);
    }
    /**
     * {@inheritDoc}
     */
    @Override
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
     * {@inheritDoc}
     */
    @Override
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
                        Objects.requireNonNull(
                                KLINE_LIST_RESPONSE_TYPE,
                                "KLINE_LIST_RESPONSE_TYPE must not be null")
                    );
            DataServiceResponse<List<Map<String, Object>>> body = response.getBody();
            if (body == null || body.data() == null) {
                log.warn("Empty response for {}/{}/{}", market, symbol, timeframe);
                return;
            }
            List<KlineDataDto> klineData = body.data().stream()
                    .map(klineDataDtoMapper::fromMap)
                    .toList();
            klineService.saveKlineData(klineData, market, symbol, timeframe);
            log.info("Synced {} records for {}/{}/{}", klineData.size(), market, symbol, timeframe);
        } catch (RestClientException e) {
            log.error("Failed to sync K-line data for {}: {}", symbol, e.getMessage());
        }
    }
    /**
     * {@inheritDoc}
     */
    @Override
    public void backfillHistoricalData(String market, String symbol, String timeframe, int days) {
        log.info("Backfilling {} days of historical data for {}/{}/{}", days, market, symbol, timeframe);
        syncSymbolKlineInternal(market, symbol, timeframe);
    }
}
