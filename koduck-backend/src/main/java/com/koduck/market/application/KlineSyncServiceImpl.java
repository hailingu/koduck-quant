package com.koduck.market.application;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

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

import com.koduck.common.constants.MarketConstants;
import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.mapper.KlineDataDtoMapper;
import com.koduck.service.KlineService;
import com.koduck.service.KlineSyncService;

import lombok.extern.slf4j.Slf4j;

/**
 * Implementation of KlineSyncService for syncing K-line data from Python Data Service.
 *
 * @author GitHub Copilot
 */
@Service
@Slf4j
public class KlineSyncServiceImpl implements KlineSyncService {

    /** REST template for data service. */
    private final RestTemplate dataServiceRestTemplate;

    /** Configuration properties for data service. */
    private final DataServiceProperties properties;

    /** Service for K-line data operations. */
    private final KlineService klineService;

    /** Mapper for K-line data DTO conversion. */
    private final KlineDataDtoMapper klineDataDtoMapper;

    /** Base path for A-share API. */
    private static final String A_SHARE_BASE_PATH = "/a-share";

    /** Default market. */
    private static final String DEFAULT_MARKET = MarketConstants.DEFAULT_MARKET;

    /** Default timeframe. */
    private static final String DEFAULT_TIMEFRAME = MarketConstants.DEFAULT_TIMEFRAME;

    /** Default interval between batch operations (milliseconds). */
    private static final long DEFAULT_BATCH_INTERVAL_MILLIS = 500L;

    /** Default limit for K-line query. */
    private static final int DEFAULT_KLINE_QUERY_LIMIT = 1000;

    /** Sleep duration between sync operations (milliseconds). */
    private static final long SYNC_SLEEP_MILLIS = 1000L;

    /** Response type reference for K-line list. */
    private static final ParameterizedTypeReference<DataServiceResponse<List<Map<String, Object>>>>
        KLINE_LIST_RESPONSE_TYPE = new ParameterizedTypeReference<>() {
        };

    /** Set of in-flight sync keys to prevent duplicate syncs. */
    private final Set<String> inFlightSyncKeys = ConcurrentHashMap.newKeySet();

    /**
     * Constructs a new KlineSyncServiceImpl.
     *
     * @param dataServiceRestTemplate the REST template for data service
     * @param properties the data service properties
     * @param klineService the K-line service
     * @param klineDataDtoMapper the K-line data DTO mapper
     */
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
            "000001",
            "000002",
            "000858",
            "002326",
            "600000",
            "600519",
            "600036",
            "601318"
        );
        for (String symbol : popularSymbols) {
            try {
                syncSymbolKlineInternal(DEFAULT_MARKET, symbol, DEFAULT_TIMEFRAME);
                // Avoid rate limiting
                Thread.sleep(SYNC_SLEEP_MILLIS);
            }
            catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                log.error("Sync interrupted", exception);
                break;
            }
            catch (Exception e) {
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
        log.info("Starting batch sync for {} symbols, market={}, timeframe={}",
            symbols.size(), market, timeframe);
        for (String symbol : symbols) {
            syncSymbolKlineInternal(market, symbol, timeframe);
            try {
                Thread.sleep(DEFAULT_BATCH_INTERVAL_MILLIS);
            }
            catch (InterruptedException exception) {
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
            }
            finally {
                inFlightSyncKeys.remove(key);
            }
        });
        return true;
    }

    /**
     * Internal method to sync K-line data for a symbol.
     *
     * @param market the market
     * @param symbol the symbol
     * @param timeframe the timeframe
     */
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
        }
        catch (RestClientException e) {
            log.error("Failed to sync K-line data for {}: {}", symbol, e.getMessage());
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void backfillHistoricalData(String market, String symbol, String timeframe, int days) {
        log.info("Backfilling {} days of historical data for {}/{}/{}",
            days, market, symbol, timeframe);
        syncSymbolKlineInternal(market, symbol, timeframe);
    }
}
