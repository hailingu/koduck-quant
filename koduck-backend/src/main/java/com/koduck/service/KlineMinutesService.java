package com.koduck.service;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.KlineDataDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Service for minute-level K-line data.
 * Fetches real-time minute data from Python Data Service.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KlineMinutesService {
    
    private final RestTemplate dataServiceRestTemplate;
    private final DataServiceProperties properties;
    
    private static final String A_SHARE_BASE_PATH = "/a-share";
    
    /**
     * Get minute-level K-line data.
     * 
     * @param market Market type (e.g., "AShare")
     * @param symbol Stock symbol
     * @param timeframe Minute timeframe (1m, 5m, 15m, 30m, 60m)
     * @param limit Maximum number of records
     * @param beforeTime Get data before this timestamp (optional)
     * @return List of K-line data
     */
    public List<KlineDataDto> getMinuteKline(String market, String symbol, String timeframe,
                                             Integer limit, Long beforeTime) {
        if (!properties.isEnabled()) {
            log.warn("Data service is disabled");
            return Collections.emptyList();
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/kline")
                    .queryParam("symbol", symbol)
                    .queryParam("timeframe", timeframe)
                    .queryParam("limit", limit)
                    .toUriString();
            
            log.debug("Fetching minute kline: {}/{}/{}, limit={}", market, symbol, timeframe, limit);
            
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                    dataServiceRestTemplate.exchange(
                            url,
                            HttpMethod.GET,
                            null,
                            new ParameterizedTypeReference<>() {}
                    );
            
            DataServiceResponse<List<Map<String, Object>>> body = response.getBody();
            if (body == null || body.data() == null) {
                return Collections.emptyList();
            }
            
            List<KlineDataDto> klines = body.data().stream()
                    .map(this::mapToKlineDataDto)
                    .toList();
            
            // Filter by beforeTime if specified
            if (beforeTime != null) {
                klines = klines.stream()
                        .filter(k -> k.timestamp() != null && k.timestamp() < beforeTime)
                        .toList();
            }
            
            log.info("Fetched {} minute kline records for {}/{}/{}", klines.size(), market, symbol, timeframe);
            return klines;
            
        } catch (RestClientException e) {
            log.error("Failed to fetch minute kline data: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
    
    /**
     * Check if timeframe is minute-level.
     */
    public boolean isMinuteTimeframe(String timeframe) {
        return timeframe != null && (timeframe.equals("1m") || timeframe.equals("5m") || 
               timeframe.equals("15m") || timeframe.equals("30m") || timeframe.equals("60m"));
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
    
    private BigDecimal getBigDecimal(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return null;
        if (value instanceof Number) {
            return BigDecimal.valueOf(((Number) value).doubleValue());
        }
        try {
            return new BigDecimal(value.toString());
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
