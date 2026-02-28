package com.koduck.service;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.KlineDataDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Map;

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
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    
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
                syncSymbolKline("AShare", symbol, "1D");
                // Avoid rate limiting
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.error("Sync interrupted");
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
        if (!properties.isEnabled()) {
            log.warn("Data service is disabled, skipping sync");
            return;
        }
        
        try {
            log.debug("Syncing K-line data for {}/{}/{}", market, symbol, timeframe);
            
            String url = UriComponentsBuilder
                    .fromHttpUrl(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/kline")
                    .queryParam("symbol", symbol)
                    .queryParam("timeframe", timeframe)
                    .queryParam("limit", 1000)
                    .toUriString();
            
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                    dataServiceRestTemplate.exchange(
                            url,
                            HttpMethod.GET,
                            null,
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
        syncSymbolKline(market, symbol, timeframe);
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
        if (value instanceof Number) {
            return java.math.BigDecimal.valueOf(((Number) value).doubleValue());
        }
        try {
            return new java.math.BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
    
    private Long getLong(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return null;
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
