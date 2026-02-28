package com.koduck.service.market;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SymbolInfoDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * AKShare data provider implementation.
 * Fetches A-share market data from Python Data Service.
 */
@Component
public class AKShareDataProvider implements MarketDataProvider {
    
    private static final Logger log = LoggerFactory.getLogger(AKShareDataProvider.class);
    private static final String A_SHARE_BASE_PATH = "/a-share";
    
    private final RestTemplate restTemplate;
    private final DataServiceProperties properties;
    
    public AKShareDataProvider(RestTemplate dataServiceRestTemplate, DataServiceProperties properties) {
        this.restTemplate = dataServiceRestTemplate;
        this.properties = properties;
    }
    
    @Override
    public MarketType getMarketType() {
        return MarketType.ASHARE;
    }
    
    @Override
    public List<SymbolInfoDto> searchSymbols(String keyword, int limit) {
        if (!properties.isEnabled()) {
            log.warn("Data service is disabled");
            return Collections.emptyList();
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/search")
                    .queryParam("keyword", keyword)
                    .queryParam("limit", limit)
                    .toUriString();
            
            log.debug("Searching symbols: keyword={}, limit={}", keyword, limit);
            
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response = 
                    restTemplate.exchange(
                            url,
                            HttpMethod.GET,
                            null,
                            new ParameterizedTypeReference<>() {}
                    );
            
            return parseSymbolListResponse(response.getBody());
            
        } catch (RestClientException e) {
            log.error("Failed to search symbols: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
    
    @Override
    public PriceQuoteDto getPrice(String symbol) {
        if (!properties.isEnabled()) {
            log.warn("Data service is disabled");
            return null;
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/price/{symbol}")
                    .buildAndExpand(symbol)
                    .toUriString();
            
            log.debug("Getting price for symbol: {}", symbol);
            
            ResponseEntity<DataServiceResponse<Map<String, Object>>> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.GET,
                            null,
                            new ParameterizedTypeReference<>() {}
                    );
            
            return parsePriceQuoteResponse(response.getBody());
            
        } catch (RestClientException e) {
            log.error("Failed to get price for {}: {}", symbol, e.getMessage());
            return null;
        }
    }
    
    @Override
    public List<PriceQuoteDto> getBatchPrices(List<String> symbols) {
        if (!properties.isEnabled()) {
            log.warn("Data service is disabled");
            return Collections.emptyList();
        }
        
        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyList();
        }
        
        try {
            String url = properties.getBaseUrl() + A_SHARE_BASE_PATH + "/price/batch";
            
            Map<String, List<String>> request = Map.of("symbols", symbols);
            
            log.debug("Getting batch prices for {} symbols", symbols.size());
            
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            new org.springframework.http.HttpEntity<>(request),
                            new ParameterizedTypeReference<>() {}
                    );
            
            DataServiceResponse<List<Map<String, Object>>> body = response.getBody();
            if (body == null || body.data() == null) {
                return Collections.emptyList();
            }
            
            return body.data().stream()
                    .map(this::mapToPriceQuoteDto)
                    .toList();
            
        } catch (RestClientException e) {
            log.error("Failed to get batch prices: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
    
    @Override
    public List<SymbolInfoDto> getHotSymbols(int limit) {
        if (!properties.isEnabled()) {
            log.warn("Data service is disabled");
            return Collections.emptyList();
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/hot")
                    .queryParam("limit", limit)
                    .toUriString();
            
            log.debug("Getting hot symbols with limit={}", limit);
            
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.GET,
                            null,
                            new ParameterizedTypeReference<>() {}
                    );
            
            return parseSymbolListResponse(response.getBody());
            
        } catch (RestClientException e) {
            log.error("Failed to get hot symbols: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
    
    private List<SymbolInfoDto> parseSymbolListResponse(DataServiceResponse<List<Map<String, Object>>> response) {
        if (response == null || response.data() == null) {
            return Collections.emptyList();
        }
        
        return response.data().stream()
                .map(this::mapToSymbolInfoDto)
                .toList();
    }
    
    private SymbolInfoDto mapToSymbolInfoDto(Map<String, Object> data) {
        return SymbolInfoDto.builder()
                .symbol(getString(data, "symbol"))
                .name(getString(data, "name"))
                .market(getString(data, "market"))
                .price(getBigDecimal(data, "price"))
                .changePercent(getBigDecimal(data, "change_percent"))
                .volume(getLong(data, "volume"))
                .amount(getBigDecimal(data, "amount"))
                .build();
    }
    
    private PriceQuoteDto parsePriceQuoteResponse(DataServiceResponse<Map<String, Object>> response) {
        if (response == null || response.data() == null) {
            return null;
        }
        
        return mapToPriceQuoteDto(response.data());
    }
    
    private PriceQuoteDto mapToPriceQuoteDto(Map<String, Object> data) {
        return PriceQuoteDto.builder()
                .symbol(getString(data, "symbol"))
                .name(getString(data, "name"))
                .price(getBigDecimal(data, "price"))
                .open(getBigDecimal(data, "open"))
                .high(getBigDecimal(data, "high"))
                .low(getBigDecimal(data, "low"))
                .prevClose(getBigDecimal(data, "prev_close"))
                .volume(getLong(data, "volume"))
                .amount(getBigDecimal(data, "amount"))
                .change(getBigDecimal(data, "change"))
                .changePercent(getBigDecimal(data, "change_percent"))
                .bidPrice(getBigDecimal(data, "bid_price"))
                .bidVolume(getLong(data, "bid_volume"))
                .askPrice(getBigDecimal(data, "ask_price"))
                .askVolume(getLong(data, "ask_volume"))
                .timestamp(getInstant(data, "timestamp"))
                .build();
    }
    
    // Helper methods for safe type conversion
    private String getString(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }
    
    private BigDecimal getBigDecimal(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) {
            return null;
        }
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
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
    
    private Instant getInstant(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof String) {
            try {
                return Instant.parse((String) value);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }
}
