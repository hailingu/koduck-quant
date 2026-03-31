package com.koduck.service.market;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.exception.ExternalServiceException;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.util.DataConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AKShare data provider implementation for A-Share market.
 * Fetches market data from Python Data Service.
 * Implements the new MarketDataProvider interface.
 */
@Component
public class AKShareDataProvider implements MarketDataProvider {
    
    private static final Logger log = LoggerFactory.getLogger(AKShareDataProvider.class);
    private static final String DATA_SERVICE_DISABLED_MESSAGE = "Data service is disabled";
    private static final String A_SHARE_BASE_PATH = "/a-share";
    private static final String KEY_SYMBOL = "symbol";
    private static final String KEY_NAME = "name";
    private static final String KEY_LIMIT = "limit";
    private static final String KEY_VOLUME = "volume";
    private static final String KEY_AMOUNT = "amount";
    private static final String EXCHANGE_SH = "SH";
    private static final String EXCHANGE_SZ = "SZ";
    private static final String EXCHANGE_CN = "CN";
    private static final String RESPONSE_TYPE_MESSAGE = "responseType must not be null";
    private static final String HTTP_GET_MESSAGE = "HTTP GET must not be null";
    private static final String HTTP_POST_MESSAGE = "HTTP POST must not be null";
    private static final ParameterizedTypeReference<DataServiceResponse<List<Map<String, Object>>>>
        LIST_DATA_RESPONSE_TYPE =
            new ParameterizedTypeReference<DataServiceResponse<List<Map<String, Object>>>>() {
            };
    private static final ParameterizedTypeReference<DataServiceResponse<Map<String, Object>>>
        MAP_DATA_RESPONSE_TYPE =
            new ParameterizedTypeReference<DataServiceResponse<Map<String, Object>>>() {
            };
    
    private final RestTemplate restTemplate;
    private final DataServiceProperties properties;
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    private volatile boolean available = true;
    private volatile int healthScore = 100;

    public AKShareDataProvider(
            @Qualifier("dataServiceRestTemplate") RestTemplate restTemplate,
            DataServiceProperties properties) {
        this.restTemplate = Objects.requireNonNull(restTemplate, "restTemplate must not be null");
        this.properties = Objects.requireNonNull(properties, "properties must not be null");
    }
    
    @Override
    public String getProviderName() {
        return "akshare-a-share";
    }
    
    @Override
    public MarketType getMarketType() {
        return MarketType.A_SHARE;
    }
    
    @Override
    public boolean isAvailable() {
        return available && properties.isEnabled();
    }
    
    @Override
    public int getHealthScore() {
        if (!properties.isEnabled()) {
            return 0;
        }
        return healthScore;
    }
    
    @Override
    public List<KlineData> getKlineData(String symbol, String timeframe, int limit,
                                         Instant startTime, Instant endTime) 
            throws MarketDataException {
        
        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }
        
        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/kline")
                    .queryParam(KEY_SYMBOL, symbol)
                    .queryParam("timeframe", timeframe)
                    .queryParam(KEY_LIMIT, limit);
            
            if (startTime != null) {
                builder.queryParam("startTime", startTime.toEpochMilli());
            }
            if (endTime != null) {
                builder.queryParam("endTime", endTime.toEpochMilli());
            }
            
            String url = builder.toUriString();
            
            log.debug("Getting kline data: symbol={}, timeframe={}, limit={}", symbol, timeframe, limit);
            
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response = 
                    restTemplate.exchange(
                            url,
                            getHttpGet(),
                            null,
                            getListDataResponseType()
                    );
            
            return parseKlineResponse(response.getBody());
            
        } catch (RestClientException e) {
            throw new MarketDataException("Failed to get kline data", e);
        }
    }
    
    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        PriceQuoteDto priceQuote = getPrice(symbol);
        if (priceQuote == null) {
            return Optional.empty();
        }
        
        TickData tickData = TickData.builder()
            .symbol(priceQuote.symbol())
            .market(MarketType.A_SHARE.getCode())
            .timestamp(priceQuote.timestamp() != null ? priceQuote.timestamp() : Instant.now())
            .price(priceQuote.price())
            .change(priceQuote.change())
            .changePercent(priceQuote.changePercent())
            .volume(priceQuote.volume())
            .amount(priceQuote.amount())
            .bidPrice(priceQuote.bidPrice())
            .bidVolume(priceQuote.bidVolume())
            .askPrice(priceQuote.askPrice())
            .askVolume(priceQuote.askVolume())
            .open(priceQuote.open())
            .dayHigh(priceQuote.high())
            .dayLow(priceQuote.low())
            .prevClose(priceQuote.prevClose())
            .build();
            
        return Optional.of(tickData);
    }
    
    @Override
    public void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback) 
            throws MarketDataException {
        
        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }
        
        subscribedSymbols.addAll(symbols);
        log.info("Subscribed to {} symbols for real-time data", symbols.size());
        
        // In production, this would establish WebSocket connection to data service
        // For now, just track subscriptions
    }
    
    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        subscribedSymbols.removeAll(symbols);
        log.info("Unsubscribed from {} symbols", symbols.size());
    }
    
    @Override
    public MarketStatus getMarketStatus() {
        // A-Share trading hours: 9:30-11:30, 13:00-15:00 (Beijing time)
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Shanghai"));
        int hour = now.getHour();
        int minute = now.getMinute();
        java.time.DayOfWeek dayOfWeek = now.getDayOfWeek();
        
        // Weekend
        if (dayOfWeek == java.time.DayOfWeek.SATURDAY || dayOfWeek == java.time.DayOfWeek.SUNDAY) {
            return MarketStatus.CLOSED;
        }
        
        int timeInMinutes = hour * 60 + minute;
        int openMorning = 9 * 60 + 30;   // 9:30
        int closeMorning = 11 * 60 + 30; // 11:30
        int openAfternoon = 13 * 60;     // 13:00
        int closeAfternoon = 15 * 60;    // 15:00
        
        if (timeInMinutes >= openMorning && timeInMinutes <= closeMorning) {
            return MarketStatus.OPEN;
        } else if (timeInMinutes > closeMorning && timeInMinutes < openAfternoon) {
            return MarketStatus.BREAK;
        } else if (timeInMinutes >= openAfternoon && timeInMinutes <= closeAfternoon) {
            return MarketStatus.OPEN;
        } else {
            return MarketStatus.CLOSED;
        }
    }
    
    @Override
    public List<SymbolInfo> searchSymbols(String keyword, int limit) {
        if (!isAvailable()) {
            log.warn(DATA_SERVICE_DISABLED_MESSAGE);
            return Collections.emptyList();
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/search")
                    .queryParam("keyword", keyword)
                    .queryParam(KEY_LIMIT, limit)
                    .toUriString();
            
            log.debug("Searching symbols: keyword={}, limit={}", keyword, limit);
            
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response = 
                    restTemplate.exchange(
                            url,
                            getHttpGet(),
                            null,
                            getListDataResponseType()
                    );
            
            return parseSymbolInfoResponse(response.getBody());
            
        } catch (RestClientException e) {
            log.error("Failed to search symbols: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
    
    // Legacy methods for backward compatibility
    
    public PriceQuoteDto getPrice(String symbol) {
        if (!isAvailable()) {
            throw new ExternalServiceException("DataService", 
                    "Data service is not available");
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/price/{symbol}")
                    .buildAndExpand(symbol)
                    .toUriString();
            
            log.debug("Getting price for symbol: {}", symbol);
            
            ResponseEntity<DataServiceResponse<Map<String, Object>>> response =
                    restTemplate.exchange(
                            url,
                            getHttpGet(),
                            null,
                            getMapDataResponseType()
                    );
            
            return parsePriceQuoteResponse(response.getBody());
            
        } catch (RestClientException e) {
            throw new ExternalServiceException("DataService",
                    "Failed to get price for " + symbol, e);
        }
    }
    
    public List<PriceQuoteDto> getBatchPrices(List<String> symbols) {
        if (!isAvailable()) {
            log.warn(DATA_SERVICE_DISABLED_MESSAGE);
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
                            getHttpPost(),
                            new org.springframework.http.HttpEntity<>(
                                Objects.requireNonNull(request, "request must not be null")),
                            getListDataResponseType()
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
    
    public List<SymbolInfoDto> getHotSymbols(int limit) {
        if (!isAvailable()) {
            log.warn(DATA_SERVICE_DISABLED_MESSAGE);
            return Collections.emptyList();
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/hot")
                    .queryParam(KEY_LIMIT, limit)
                    .toUriString();
            
            log.debug("Getting hot symbols with limit={}", limit);
            
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                    restTemplate.exchange(
                            url,
                            getHttpGet(),
                            null,
                            getListDataResponseType()
                    );
            
            return parseSymbolListResponse(response.getBody());
            
        } catch (RestClientException e) {
            log.error("Failed to get hot symbols: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
    
    public StockValuationDto getStockValuation(String symbol) {
        if (!isAvailable()) {
            throw new ExternalServiceException("DataService",
                    "Data service is not available");
        }

        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/valuation/{symbol}")
                    .buildAndExpand(symbol)
                    .toUriString();

            log.debug("Getting valuation for symbol: {}", symbol);

            ResponseEntity<DataServiceResponse<Map<String, Object>>> response =
                    restTemplate.exchange(
                            url,
                            getHttpGet(),
                            null,
                            getMapDataResponseType()
                    );

            return parseStockValuationResponse(response.getBody());

        } catch (RestClientException e) {
            throw new ExternalServiceException("DataService",
                    "Failed to get valuation for " + symbol, e);
        }
    }
    
    public StockIndustryDto getStockIndustry(String symbol) {
        if (!isAvailable()) {
            throw new ExternalServiceException("DataService",
                    "Data service is not available");
        }

        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + "/market/stocks/{symbol}/industry")
                    .buildAndExpand(symbol)
                    .toUriString();

            log.debug("Getting industry for symbol: {}", symbol);

            ResponseEntity<DataServiceResponse<Map<String, Object>>> response =
                    restTemplate.exchange(
                            url,
                            getHttpGet(),
                            null,
                            getMapDataResponseType()
                    );

            return parseStockIndustryResponse(response.getBody());

        } catch (RestClientException e) {
            throw new ExternalServiceException("DataService",
                    "Failed to get industry for " + symbol, e);
        }
    }
    
    // Helper methods
    
    private List<KlineData> parseKlineResponse(DataServiceResponse<List<Map<String, Object>>> response) {
        if (response == null || response.data() == null) {
            return Collections.emptyList();
        }
        
        return response.data().stream()
                .map(this::mapToKlineData)
                .toList();
    }
    
    private KlineData mapToKlineData(Map<String, Object> data) {
        return KlineData.builder()
            .symbol(getString(data, KEY_SYMBOL))
            .market(MarketType.A_SHARE.getCode())
            .timestamp(DataConverter.toInstantFromMillis(getLong(data, "timestamp")))
            .open(DataConverter.toBigDecimal(getString(data, "open")))
            .high(DataConverter.toBigDecimal(getString(data, "high")))
            .low(DataConverter.toBigDecimal(getString(data, "low")))
            .close(DataConverter.toBigDecimal(getString(data, "close")))
            .volume(getLong(data, KEY_VOLUME))
            .amount(DataConverter.toBigDecimal(getString(data, KEY_AMOUNT)))
            .timeframe(getString(data, "timeframe"))
            .build();
    }
    
    private List<SymbolInfo> parseSymbolInfoResponse(DataServiceResponse<List<Map<String, Object>>> response) {
        if (response == null || response.data() == null) {
            return Collections.emptyList();
        }
        
        return response.data().stream()
                .map(this::mapToSymbolInfo)
                .toList();
    }
    
    private SymbolInfo mapToSymbolInfo(Map<String, Object> data) {
        String symbol = getString(data, KEY_SYMBOL);
        // Normalize symbol with exchange suffix
        String normalizedSymbol = DataConverter.normalizeSymbol(symbol, MarketType.A_SHARE.getCode());
        String exchange = resolveExchange(normalizedSymbol);
        
        return new SymbolInfo(
            normalizedSymbol,
            getString(data, KEY_NAME),
            MarketType.A_SHARE.getCode(),
            exchange,
            "stock"
        );
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
                .symbol(getString(data, KEY_SYMBOL))
                .name(getString(data, KEY_NAME))
                .type(Optional.ofNullable(getString(data, "type")).orElse("STOCK"))
                .market(getString(data, "market"))
                .price(DataConverter.toBigDecimal(getString(data, "price")))
                .changePercent(DataConverter.toBigDecimal(getString(data, "change_percent")))
                .volume(getLong(data, KEY_VOLUME))
                .amount(DataConverter.toBigDecimal(getString(data, KEY_AMOUNT)))
                .build();
    }
    
    private PriceQuoteDto parsePriceQuoteResponse(DataServiceResponse<Map<String, Object>> response) {
        if (response == null || response.data() == null) {
            return null;
        }
        
        return mapToPriceQuoteDto(response.data());
    }

    private StockValuationDto parseStockValuationResponse(DataServiceResponse<Map<String, Object>> response) {
        if (response == null || response.data() == null) {
            return null;
        }

        return mapToStockValuationDto(response.data());
    }

    private StockIndustryDto parseStockIndustryResponse(DataServiceResponse<Map<String, Object>> response) {
        if (response == null || response.data() == null) {
            return null;
        }

        return mapToStockIndustryDto(response.data());
    }
    
    private PriceQuoteDto mapToPriceQuoteDto(Map<String, Object> data) {
        return PriceQuoteDto.builder()
                .symbol(getString(data, KEY_SYMBOL))
                .name(getString(data, KEY_NAME))
                .type(Optional.ofNullable(getString(data, "type")).orElse("STOCK"))
                .price(DataConverter.toBigDecimal(getString(data, "price")))
                .open(DataConverter.toBigDecimal(getString(data, "open")))
                .high(DataConverter.toBigDecimal(getString(data, "high")))
                .low(DataConverter.toBigDecimal(getString(data, "low")))
                .prevClose(DataConverter.toBigDecimal(getString(data, "prev_close")))
                .volume(getLong(data, KEY_VOLUME))
                .amount(DataConverter.toBigDecimal(getString(data, KEY_AMOUNT)))
                .change(DataConverter.toBigDecimal(getString(data, "change")))
                .changePercent(DataConverter.toBigDecimal(getString(data, "change_percent")))
                .bidPrice(DataConverter.toBigDecimal(getString(data, "bid_price")))
                .bidVolume(getLong(data, "bid_volume"))
                .askPrice(DataConverter.toBigDecimal(getString(data, "ask_price")))
                .askVolume(getLong(data, "ask_volume"))
                .timestamp(getInstant(data, "timestamp"))
                .build();
    }

    private StockValuationDto mapToStockValuationDto(Map<String, Object> data) {
        return StockValuationDto.builder()
                .symbol(getString(data, KEY_SYMBOL))
                .name(getString(data, KEY_NAME))
                .peTtm(DataConverter.toBigDecimal(getString(data, "pe_ttm")))
                .pb(DataConverter.toBigDecimal(getString(data, "pb")))
                .psTtm(DataConverter.toBigDecimal(getString(data, "ps_ttm")))
                .marketCap(DataConverter.toBigDecimal(getString(data, "market_cap")))
                .floatMarketCap(DataConverter.toBigDecimal(getString(data, "float_market_cap")))
                .totalShares(DataConverter.toBigDecimal(getString(data, "total_shares")))
                .floatShares(DataConverter.toBigDecimal(getString(data, "float_shares")))
                .floatRatio(DataConverter.toBigDecimal(getString(data, "float_ratio")))
                .turnoverRate(DataConverter.toBigDecimal(getString(data, "turnover_rate")))
                .build();
    }

    private StockIndustryDto mapToStockIndustryDto(Map<String, Object> data) {
        return StockIndustryDto.builder()
                .symbol(getString(data, KEY_SYMBOL))
                .name(getString(data, KEY_NAME))
                .industry(getString(data, "industry"))
                .sector(getString(data, "sector"))
                .subIndustry(getString(data, "sub_industry"))
                .board(getString(data, "board"))
                .build();
    }
    
    // Helper methods for safe type conversion
    private String getString(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }
    
    private Long getLong(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException _) {
            return null;
        }
    }
    
    private Instant getInstant(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof String timestamp) {
            try {
                return Instant.parse(timestamp);
            } catch (Exception _) {
                return null;
            }
        }
        return null;
    }

    private String resolveExchange(String normalizedSymbol) {
        if (normalizedSymbol.contains(".SH")) {
            return EXCHANGE_SH;
        }
        if (normalizedSymbol.contains(".SZ")) {
            return EXCHANGE_SZ;
        }
        return EXCHANGE_CN;
    }

    private static @NonNull HttpMethod getHttpGet() {
        return Objects.requireNonNull(HttpMethod.GET, HTTP_GET_MESSAGE);
    }

    private static @NonNull HttpMethod getHttpPost() {
        return Objects.requireNonNull(HttpMethod.POST, HTTP_POST_MESSAGE);
    }

    private static @NonNull ParameterizedTypeReference<DataServiceResponse<List<Map<String, Object>>>>
    getListDataResponseType() {
        return Objects.requireNonNull(LIST_DATA_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE);
    }

    private static @NonNull ParameterizedTypeReference<DataServiceResponse<Map<String, Object>>> getMapDataResponseType() {
        return Objects.requireNonNull(MAP_DATA_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE);
    }
}
