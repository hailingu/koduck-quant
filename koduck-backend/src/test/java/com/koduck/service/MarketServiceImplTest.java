package com.koduck.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.lang.NonNull;

import com.koduck.common.constants.MarketConstants;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.entity.market.StockBasic;
import com.koduck.entity.market.StockRealtime;
import com.koduck.repository.market.StockBasicRepository;
import com.koduck.repository.market.StockRealtimeRepository;
import com.koduck.service.impl.market.MarketServiceImpl;
import com.koduck.service.support.MarketFallbackSupport;
import com.koduck.service.support.market.MarketDtoMapper;
import com.koduck.service.support.market.MockSectorNetworkGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link MarketServiceImpl}.
 *
 * @author GitHub Copilot
 */
@ExtendWith(MockitoExtension.class)
class MarketServiceImplTest {

    /**
     * Default page size for search operations.
     */
    private static final int DEFAULT_PAGE_SIZE = 20;

    /**
     * Small page size for fallback search operations.
     */
    private static final int SMALL_PAGE_SIZE = 5;

    /**
     * First page number for pagination.
     */
    private static final int FIRST_PAGE = 1;

    /**
     * Invalid page number for testing edge cases.
     */
    private static final int INVALID_PAGE = 0;

    /**
     * Single result count.
     */
    private static final int SINGLE_RESULT = 1;

    /**
     * Double result count.
     */
    private static final int DOUBLE_RESULT = 2;

    /**
     * Test volume value for stock realtime data.
     */
    private static final long TEST_VOLUME = 125800L;

    /**
     * Test amount value for stock realtime data.
     */
    private static final String TEST_AMOUNT = "1201500.00";

    /**
     * Test kline timestamp value.
     */
    private static final long KLINE_TIMESTAMP = 1741348800L;

    /**
     * Test kline volume value.
     */
    private static final long KLINE_VOLUME = 258000L;

    /**
     * Test kline amount value.
     */
    private static final String KLINE_AMOUNT = "3158200.00";

    /**
     * Previous kline timestamp value.
     */
    private static final long PREV_KLINE_TIMESTAMP = 1741262400L;

    /**
     * Test previous volume value.
     */
    private static final long PREV_VOLUME = 1200000L;

    /**
     * Test previous amount value.
     */
    private static final String PREV_AMOUNT = "18360000.00";

    /**
     * Mock repository for stock realtime data.
     */
    @Mock
    private StockRealtimeRepository stockRealtimeRepository;

    /**
     * Mock repository for stock basic data.
     */
    @Mock
    private StockBasicRepository stockBasicRepository;

    /**
     * Mock service for stock cache operations.
     */
    @Mock
    private StockCacheService stockCacheService;

    /**
     * Mock support for market fallback operations.
     */
    @Mock
    private MarketFallbackSupport marketFallbackSupport;

    /**
     * Service under test.
     */
    private MarketServiceImpl marketService;

    @BeforeEach
    void setUp() {
        MarketDtoMapper marketDtoMapper = new MarketDtoMapper();
        ObjectMapper objectMapper = new ObjectMapper();
        MockSectorNetworkGenerator mockSectorNetworkGenerator = new MockSectorNetworkGenerator(objectMapper);
        marketService = new MarketServiceImpl(
                stockRealtimeRepository,
                stockBasicRepository,
                stockCacheService,
                marketDtoMapper,
                mockSectorNetworkGenerator,
                marketFallbackSupport);
    }

    @Test
    @DisplayName("shouldReturnSymbolResultsWhenSearchKeywordIsValid")
    void shouldReturnSymbolResultsWhenSearchKeywordIsValid() {
        StockBasic basic = StockBasic.builder()
                .symbol("002326")
                .name("永太科技")
                .market("AShare")
                .build();
        StockRealtime realtime = StockRealtime.builder()
                .symbol("002326")
                .name("永太科技")
                .price(new BigDecimal("9.55"))
                .changePercent(new BigDecimal("2.35"))
                .volume(TEST_VOLUME)
                .amount(new BigDecimal(TEST_AMOUNT))
                .build();

        when(stockBasicRepository.searchByKeyword("永太", PageRequest.of(0, DEFAULT_PAGE_SIZE)))
                .thenReturn(new PageImpl<>(stockBasicsOf(basic)));
        when(stockRealtimeRepository.findBySymbolIn(List.of("002326")))
                .thenReturn(List.of(realtime));

        List<SymbolInfoDto> results = marketService.searchSymbols("永太", FIRST_PAGE, DEFAULT_PAGE_SIZE);

        assertThat(results).hasSize(SINGLE_RESULT);
        assertThat(results.get(0).symbol()).isEqualTo("002326");
        assertThat(results.get(0).name()).isEqualTo("永太科技");
    }

    @Test
    @DisplayName("shouldNormalizeAndDeduplicateSearchSymbols")
    void shouldNormalizeAndDeduplicateSearchSymbols() {
        StockBasic shortCode = StockBasic.builder()
                .symbol("2885")
                .name("京泉华")
                .market("SZSE")
                .build();
        StockBasic canonicalCode = StockBasic.builder()
                .symbol("002885")
                .name("京泉华")
                .market("SZSE")
                .build();
        StockRealtime realtime = StockRealtime.builder()
                .symbol("002885")
                .name("京泉华")
                .price(new BigDecimal("32.50"))
                .changePercent(new BigDecimal("1.20"))
                .build();

        when(stockBasicRepository.searchByKeyword("京泉华", PageRequest.of(0, DEFAULT_PAGE_SIZE)))
                .thenReturn(new PageImpl<>(stockBasicsOf(shortCode, canonicalCode)));
        when(stockRealtimeRepository.findBySymbolIn(List.of("2885", "002885")))
                .thenReturn(List.of(realtime));

        List<SymbolInfoDto> results = marketService.searchSymbols("京泉华", FIRST_PAGE, DEFAULT_PAGE_SIZE);

        assertThat(results).hasSize(SINGLE_RESULT);
        assertThat(results.get(0).symbol()).isEqualTo("002885");
        assertThat(results.get(0).name()).isEqualTo("京泉华");
    }

    @Test
    @DisplayName("shouldReturnEmptyListWhenSearchParamsAreInvalid")
    void shouldReturnEmptyListWhenSearchParamsAreInvalid() {
        List<SymbolInfoDto> results = marketService.searchSymbols("", FIRST_PAGE, DEFAULT_PAGE_SIZE);

        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("shouldFallbackToDataServiceWhenDatabaseSearchReturnsEmpty")
    void shouldFallbackToDataServiceWhenDatabaseSearchReturnsEmpty() {
        when(stockBasicRepository.searchByKeyword("隆基", PageRequest.of(0, SMALL_PAGE_SIZE)))
                .thenReturn(new PageImpl<>(emptyStockBasics()));
        when(marketFallbackSupport.searchSymbolsFromProvider("隆基", SMALL_PAGE_SIZE))
                .thenReturn(List.of(
                        SymbolInfoDto.builder()
                                .symbol("601012")
                                .name("隆基绿能")
                                .market("AShare")
                                .type(MarketConstants.STOCK_TYPE)
                                .build(),
                        SymbolInfoDto.builder()
                                .symbol("002363")
                                .name("隆基机械")
                                .market("AShare")
                                .type(MarketConstants.STOCK_TYPE)
                                .build()
                ));

        List<SymbolInfoDto> results = marketService.searchSymbols("隆基", FIRST_PAGE, SMALL_PAGE_SIZE);

        assertThat(results).hasSize(DOUBLE_RESULT);
        assertThat(results).extracting(SymbolInfoDto::symbol).containsExactly("601012", "002363");
        assertThat(results).extracting(SymbolInfoDto::name).containsExactly("隆基绿能", "隆基机械");
    }

    @Test
    @DisplayName("shouldReturnStockDetailWhenSymbolExists")
    void shouldReturnStockDetailWhenSymbolExists() {
        StockRealtime realtime = StockRealtime.builder()
                .symbol("002326")
                .name("永太科技")
                .price(new BigDecimal("9.55"))
                .openPrice(new BigDecimal("9.35"))
                .high(new BigDecimal("9.68"))
                .low(new BigDecimal("9.30"))
                .prevClose(new BigDecimal("9.33"))
                .volume(TEST_VOLUME)
                .amount(new BigDecimal(TEST_AMOUNT))
                .changeAmount(new BigDecimal("0.22"))
                .changePercent(new BigDecimal("2.36"))
                .updatedAt(LocalDateTime.now())
                .build();

        when(stockRealtimeRepository.findFirstBySymbolOrderByUpdatedAtDesc("002326"))
                .thenReturn(Optional.of(realtime));

        PriceQuoteDto quote = marketService.getStockDetail("002326");

        assertThat(quote).isNotNull();
        assertThat(quote.symbol()).isEqualTo("002326");
        assertThat(quote.name()).isEqualTo("永太科技");
        assertThat(quote.price()).isEqualByComparingTo(new BigDecimal("9.55"));
    }

    @Test
    @DisplayName("shouldBuildStockDetailFromLatestKlineWhenRealtimeIsMissing")
    void shouldBuildStockDetailFromLatestKlineWhenRealtimeIsMissing() {
        KlineDataDto latestKline = new KlineDataDto(
                KLINE_TIMESTAMP,
                new BigDecimal("12.10"),
                new BigDecimal("12.35"),
                new BigDecimal("11.98"),
                new BigDecimal("12.28"),
                KLINE_VOLUME,
                new BigDecimal(KLINE_AMOUNT));

        when(stockRealtimeRepository.findFirstBySymbolOrderByUpdatedAtDesc("002885"))
                .thenReturn(Optional.empty());
        when(marketFallbackSupport.tryBuildQuoteFromLatestKline("002885"))
                .thenReturn(PriceQuoteDto.builder()
                        .symbol("002885")
                        .name("京泉华")
                        .price(latestKline.close())
                        .change(new BigDecimal("0.28"))
                        .changePercent(new BigDecimal("2.3333"))
                        .build());

        PriceQuoteDto quote = marketService.getStockDetail("002885");

        assertThat(quote).isNotNull();
        assertThat(quote.symbol()).isEqualTo("002885");
        assertThat(quote.name()).isEqualTo("京泉华");
        assertThat(quote.price()).isEqualByComparingTo(new BigDecimal("12.28"));
        assertThat(quote.change()).isEqualByComparingTo(new BigDecimal("0.28"));
        assertThat(quote.changePercent()).isEqualByComparingTo(new BigDecimal("2.3333"));
    }

    @Test
    @DisplayName("shouldBuildStockDetailFromCachedMapKlineWhenCacheReturnsLinkedHashMap")
    void shouldBuildStockDetailFromCachedMapKlineWhenCacheReturnsLinkedHashMap() {
        Map<String, Object> previous = new LinkedHashMap<>();
        previous.put("timestamp", PREV_KLINE_TIMESTAMP);
        previous.put("open", "15.20");
        previous.put("high", "15.50");
        previous.put("low", "15.10");
        previous.put("close", "15.30");
        previous.put("volume", PREV_VOLUME);
        previous.put("amount", PREV_AMOUNT);

        Map<String, Object> latest = new LinkedHashMap<>();
        latest.put("timestamp", KLINE_TIMESTAMP);
        latest.put("open", "15.31");
        latest.put("high", "15.60");
        latest.put("low", "15.20");
        latest.put("close", "15.45");
        latest.put("volume", PREV_VOLUME);
        latest.put("amount", PREV_AMOUNT);

        when(stockRealtimeRepository.findFirstBySymbolOrderByUpdatedAtDesc("601919"))
                .thenReturn(Optional.empty());
        KlineDataDto latestKline = new KlineDataDto(
                ((Number) latest.get("timestamp")).longValue(),
                new BigDecimal(latest.get("open").toString()),
                new BigDecimal(latest.get("high").toString()),
                new BigDecimal(latest.get("low").toString()),
                new BigDecimal(latest.get("close").toString()),
                ((Number) latest.get("volume")).longValue(),
                new BigDecimal(latest.get("amount").toString()));

        when(marketFallbackSupport.tryBuildQuoteFromLatestKline("601919"))
                .thenReturn(PriceQuoteDto.builder()
                        .symbol("601919")
                        .name("中远海控")
                        .price(latestKline.close())
                        .change(new BigDecimal("0.15"))
                        .build());

        PriceQuoteDto quote = marketService.getStockDetail("601919");

        assertThat(quote).isNotNull();
        assertThat(quote.symbol()).isEqualTo("601919");
        assertThat(quote.price()).isEqualByComparingTo(new BigDecimal("15.45"));
        assertThat(quote.change()).isEqualByComparingTo(new BigDecimal("0.15"));
    }

    @Test
    @DisplayName("shouldReturnDataServiceQuoteWhenRealtimeIsMissing")
    void shouldReturnDataServiceQuoteWhenRealtimeIsMissing() {
        PriceQuoteDto providerQuote = PriceQuoteDto.builder()
                .symbol("002885")
                .name("京泉华")
                .price(new BigDecimal("32.50"))
                .changePercent(new BigDecimal("-0.76"))
                .build();

        when(stockRealtimeRepository.findFirstBySymbolOrderByUpdatedAtDesc("002885"))
                .thenReturn(Optional.empty());
        when(marketFallbackSupport.fetchProviderPrice("002885")).thenReturn(providerQuote);

        PriceQuoteDto quote = marketService.getStockDetail("002885");

        assertThat(quote).isNotNull();
        assertThat(quote.symbol()).isEqualTo("002885");
        assertThat(quote.name()).isEqualTo("京泉华");
        assertThat(quote.price()).isEqualByComparingTo(new BigDecimal("32.50"));
        verify(marketFallbackSupport).fetchProviderPrice("002885");
    }

    @Test
    @DisplayName("shouldRecoverFromRealtimeLookupExceptionUsingDataServiceQuote")
    void shouldRecoverFromRealtimeLookupExceptionUsingDataServiceQuote() {
        PriceQuoteDto providerQuote = PriceQuoteDto.builder()
                .symbol("601919")
                .name("中远海控")
                .price(new BigDecimal("15.45"))
                .changePercent(BigDecimal.ZERO)
                .build();

        when(stockRealtimeRepository.findFirstBySymbolOrderByUpdatedAtDesc("601919"))
                .thenThrow(new RuntimeException("db lookup failed"));
        when(marketFallbackSupport.fetchProviderPrice("601919")).thenReturn(providerQuote);

        PriceQuoteDto quote = marketService.getStockDetail("601919");

        assertThat(quote).isNotNull();
        assertThat(quote.symbol()).isEqualTo("601919");
        assertThat(quote.name()).isEqualTo("中远海控");
        assertThat(quote.price()).isEqualByComparingTo(new BigDecimal("15.45"));
        verify(marketFallbackSupport).fetchProviderPrice("601919");
    }

    @Test
    @DisplayName("shouldReturnNullWhenStockDetailSymbolIsBlank")
    void shouldReturnNullWhenStockDetailSymbolIsBlank() {
        PriceQuoteDto quote = marketService.getStockDetail(" ");

        assertThat(quote).isNull();
    }

    @Test
    @DisplayName("shouldReturnStockValuationFromDataService")
    void shouldReturnStockValuationFromDataService() {
        StockValuationDto valuation = StockValuationDto.builder()
                .symbol("601012")
                .name("隆基绿能")
                .peTtm(new BigDecimal("18.39"))
                .pb(new BigDecimal("2.17"))
                .marketCap(new BigDecimal("1393.52"))
                .build();

        when(marketFallbackSupport.fetchProviderValuation("601012")).thenReturn(valuation);

        StockValuationDto result = marketService.getStockValuation("601012");

        assertThat(result).isNotNull();
        assertThat(result.symbol()).isEqualTo("601012");
        assertThat(result.peTtm()).isEqualByComparingTo(new BigDecimal("18.39"));
        assertThat(result.pb()).isEqualByComparingTo(new BigDecimal("2.17"));
        assertThat(result.marketCap()).isEqualByComparingTo(new BigDecimal("1393.52"));
        verify(marketFallbackSupport).fetchProviderValuation("601012");
    }

    @Test
    @DisplayName("shouldReturnStockIndustryFromDataService")
    void shouldReturnStockIndustryFromDataService() {
        StockIndustryDto industry = StockIndustryDto.builder()
                .symbol("601012")
                .name("隆基绿能")
                .industry("电力设备")
                .sector("新能源")
                .subIndustry("光伏设备")
                .board("主板")
                .build();

        when(marketFallbackSupport.fetchProviderIndustry("601012")).thenReturn(industry);

        StockIndustryDto result = marketService.getStockIndustry("601012");

        assertThat(result).isNotNull();
        assertThat(result.symbol()).isEqualTo("601012");
        assertThat(result.industry()).isEqualTo("电力设备");
        assertThat(result.subIndustry()).isEqualTo("光伏设备");
        verify(marketFallbackSupport).fetchProviderIndustry("601012");
    }

    @Test
    @DisplayName("shouldReturnIndicesWhenMainIndexDataExists")
    void shouldReturnIndicesWhenMainIndexDataExists() {
        StockRealtime index = StockRealtime.builder()
                .symbol("000001")
                .name("上证指数")
                .price(new BigDecimal("3250.68"))
                .changeAmount(new BigDecimal("25.35"))
                .changePercent(new BigDecimal("0.78"))
                .updatedAt(LocalDateTime.now())
                .build();

        when(stockRealtimeRepository.findBySymbolInAndType(
                List.of("000001", "399001", "399006"), MarketConstants.INDEX_TYPE))
                .thenReturn(List.of(index));

        List<MarketIndexDto> indices = marketService.getMarketIndices();

        assertThat(indices).hasSize(SINGLE_RESULT);
        assertThat(indices.get(0).symbol()).isEqualTo("000001");
        assertThat(indices.get(0).name()).isEqualTo("上证指数");
    }

    @Test
    @DisplayName("shouldMergeCacheAndDatabaseResultsWhenBatchPricesRequested")
    void shouldMergeCacheAndDatabaseResultsWhenBatchPricesRequested() {
        PriceQuoteDto cachedQuote = PriceQuoteDto.builder()
                .symbol("002326")
                .name("永太科技")
                .price(new BigDecimal("9.55"))
                .build();
        StockRealtime realtime = StockRealtime.builder()
                .symbol("000001")
                .name("平安银行")
                .price(new BigDecimal("12.34"))
                .updatedAt(LocalDateTime.now())
                .build();

        when(stockCacheService.getCachedStockTracks(List.of("002326", "000001")))
                .thenReturn(List.of(cachedQuote));
        when(stockRealtimeRepository.findBySymbolIn(List.of("000001"))).thenReturn(List.of(realtime));

        List<PriceQuoteDto> quotes = marketService.getBatchPrices(List.of("002326", "000001"));

        assertThat(quotes).hasSize(DOUBLE_RESULT);
        assertThat(quotes.get(0).symbol()).isEqualTo("002326");
        assertThat(quotes.get(1).symbol()).isEqualTo("000001");
        verify(stockCacheService).cacheBatchStockTracks(
                org.mockito.ArgumentMatchers.<List<PriceQuoteDto>>any());
    }

    @Test
    @DisplayName("shouldReturnEmptyListWhenBatchSymbolsIsEmpty")
    void shouldReturnEmptyListWhenBatchSymbolsIsEmpty() {
        List<PriceQuoteDto> quotes = marketService.getBatchPrices(List.of());

        assertThat(quotes).isEmpty();
    }

    // ==================== Exception Path Tests ====================

    @Test
    @DisplayName("shouldReturnEmptyListWhenSearchPageIsInvalid")
    void shouldReturnEmptyListWhenSearchPageIsInvalid() {
        List<SymbolInfoDto> results = marketService.searchSymbols("keyword", INVALID_PAGE, DEFAULT_PAGE_SIZE);

        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("shouldReturnEmptyListWhenSearchSizeIsInvalid")
    void shouldReturnEmptyListWhenSearchSizeIsInvalid() {
        List<SymbolInfoDto> results = marketService.searchSymbols("keyword", FIRST_PAGE, INVALID_PAGE);

        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("shouldReturnNullWhenStockDetailSymbolIsNull")
    void shouldReturnNullWhenStockDetailSymbolIsNull() {
        PriceQuoteDto quote = marketService.getStockDetail(null);

        assertThat(quote).isNull();
    }

    @Test
    @DisplayName("shouldReturnNullWhenAllFallbacksFailForStockDetail")
    void shouldReturnNullWhenAllFallbacksFailForStockDetail() {
        when(stockRealtimeRepository.findFirstBySymbolOrderByUpdatedAtDesc("UNKNOWN"))
                .thenReturn(Optional.empty());
        when(marketFallbackSupport.tryBuildQuoteFromLatestKline("UNKNOWN"))
                .thenReturn(null);
        when(marketFallbackSupport.fetchProviderPrice("UNKNOWN"))
                .thenReturn(null);

        PriceQuoteDto quote = marketService.getStockDetail("UNKNOWN");

        assertThat(quote).isNull();
    }

    @Test
    @DisplayName("shouldReturnNullWhenStockValuationSymbolIsNull")
    void shouldReturnNullWhenStockValuationSymbolIsNull() {
        StockValuationDto valuation = marketService.getStockValuation(null);

        assertThat(valuation).isNull();
    }

    @Test
    @DisplayName("shouldReturnNullWhenStockValuationSymbolIsBlank")
    void shouldReturnNullWhenStockValuationSymbolIsBlank() {
        StockValuationDto valuation = marketService.getStockValuation("   ");

        assertThat(valuation).isNull();
    }

    @Test
    @DisplayName("shouldPropagateExceptionWhenValuationFetchFails")
    void shouldPropagateExceptionWhenValuationFetchFails() {
        when(marketFallbackSupport.fetchProviderValuation("600519"))
                .thenThrow(new RuntimeException("Service unavailable"));

        assertThatThrownBy(() -> marketService.getStockValuation("600519"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Service unavailable");
    }

    @Test
    @DisplayName("shouldReturnNullWhenStockIndustrySymbolIsNull")
    void shouldReturnNullWhenStockIndustrySymbolIsNull() {
        StockIndustryDto industry = marketService.getStockIndustry(null);

        assertThat(industry).isNull();
    }

    @Test
    @DisplayName("shouldReturnNullWhenStockIndustrySymbolIsBlank")
    void shouldReturnNullWhenStockIndustrySymbolIsBlank() {
        StockIndustryDto industry = marketService.getStockIndustry("   ");

        assertThat(industry).isNull();
    }

    @Test
    @DisplayName("shouldReturnNullWhenIndustryFetchThrowsException")
    void shouldReturnNullWhenIndustryFetchThrowsException() {
        when(marketFallbackSupport.fetchProviderIndustry("600519"))
                .thenThrow(new RuntimeException("Service error"));

        StockIndustryDto industry = marketService.getStockIndustry("600519");

        assertThat(industry).isNull();
    }

    @Test
    @DisplayName("shouldReturnEmptyMapWhenGetStockIndustriesWithNullSymbols")
    void shouldReturnEmptyMapWhenGetStockIndustriesWithNullSymbols() {
        Map<String, StockIndustryDto> results = marketService.getStockIndustries(null);

        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("shouldReturnEmptyMapWhenGetStockIndustriesWithEmptySymbols")
    void shouldReturnEmptyMapWhenGetStockIndustriesWithEmptySymbols() {
        Map<String, StockIndustryDto> results = marketService.getStockIndustries(List.of());

        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("shouldSkipNullAndBlankSymbolsInBatchIndustryLookup")
    void shouldSkipNullAndBlankSymbolsInBatchIndustryLookup() {
        StockIndustryDto industry = StockIndustryDto.builder()
                .symbol("600519")
                .name("贵州茅台")
                .industry("白酒")
                .build();

        when(marketFallbackSupport.fetchProviderIndustries(List.of("600519")))
                .thenReturn(Map.of("600519", industry));

        List<String> symbols = new ArrayList<>();
        symbols.add(null);
        symbols.add("");
        symbols.add("   ");
        symbols.add("600519");
        Map<String, StockIndustryDto> results = marketService.getStockIndustries(symbols);

        assertThat(results).hasSize(SINGLE_RESULT);
        assertThat(results.get("600519")).isNotNull();
    }

    @Test
    @DisplayName("shouldReturnBatchIndustriesFromDataService")
    void shouldReturnBatchIndustriesFromDataService() {
        StockIndustryDto industry1 = StockIndustryDto.builder()
                .symbol("601012")
                .name("隆基绿能")
                .industry("电力设备")
                .build();
        StockIndustryDto industry2 = StockIndustryDto.builder()
                .symbol("600519")
                .name("贵州茅台")
                .industry("白酒")
                .build();

        when(marketFallbackSupport.fetchProviderIndustries(List.of("601012", "600519")))
                .thenReturn(Map.of("601012", industry1, "600519", industry2));

        Map<String, StockIndustryDto> results = marketService.getStockIndustries(List.of("601012", "600519"));

        assertThat(results).hasSize(DOUBLE_RESULT);
        assertThat(results.get("601012").industry()).isEqualTo("电力设备");
        assertThat(results.get("600519").industry()).isEqualTo("白酒");
    }

    @Test
    @DisplayName("shouldReturnEmptyMapWhenBatchIndustryFetchFails")
    void shouldReturnEmptyMapWhenBatchIndustryFetchFails() {
        when(marketFallbackSupport.fetchProviderIndustries(List.of("600519")))
                .thenThrow(new RuntimeException("Service error"));

        Map<String, StockIndustryDto> results = marketService.getStockIndustries(List.of("600519"));

        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("shouldDeduplicateSymbolsInBatchIndustryLookup")
    void shouldDeduplicateSymbolsInBatchIndustryLookup() {
        StockIndustryDto industry = StockIndustryDto.builder()
                .symbol("600519")
                .name("贵州茅台")
                .industry("白酒")
                .build();

        when(marketFallbackSupport.fetchProviderIndustries(List.of("600519")))
                .thenReturn(Map.of("600519", industry));

        Map<String, StockIndustryDto> results = marketService.getStockIndustries(List.of("600519", "600519", "600519"));

        assertThat(results).hasSize(SINGLE_RESULT);
        verify(marketFallbackSupport).fetchProviderIndustries(List.of("600519"));
    }

    @Test
    @DisplayName("shouldReturnEmptyListWhenNoIndicesFoundInRealtimeOrBasic")
    void shouldReturnEmptyListWhenNoIndicesFoundInRealtimeOrBasic() {
        when(stockRealtimeRepository.findBySymbolInAndType(
                List.of("000001", "399001", "399006"), MarketConstants.INDEX_TYPE))
                .thenReturn(List.of());
        when(stockBasicRepository.findBySymbolInAndType(
                List.of("000001", "399001", "399006"), MarketConstants.INDEX_TYPE))
                .thenReturn(List.of());

        List<MarketIndexDto> indices = marketService.getMarketIndices();

        assertThat(indices).isEmpty();
    }

    @Test
    @DisplayName("shouldReturnEmptyListWhenBatchPricesWithNullSymbols")
    void shouldReturnEmptyListWhenBatchPricesWithNullSymbols() {
        List<PriceQuoteDto> quotes = marketService.getBatchPrices(null);

        assertThat(quotes).isEmpty();
    }

    @Test
    @DisplayName("shouldReturnAllFromCacheWhenAllSymbolsCached")
    void shouldReturnAllFromCacheWhenAllSymbolsCached() {
        PriceQuoteDto cachedQuote1 = PriceQuoteDto.builder()
                .symbol("002326")
                .name("永太科技")
                .price(new BigDecimal("9.55"))
                .build();
        PriceQuoteDto cachedQuote2 = PriceQuoteDto.builder()
                .symbol("000001")
                .name("平安银行")
                .price(new BigDecimal("12.34"))
                .build();

        when(stockCacheService.getCachedStockTracks(List.of("002326", "000001")))
                .thenReturn(List.of(cachedQuote1, cachedQuote2));

        List<PriceQuoteDto> quotes = marketService.getBatchPrices(List.of("002326", "000001"));

        assertThat(quotes).hasSize(DOUBLE_RESULT);
        verify(stockCacheService, never()).cacheBatchStockTracks(any());
    }

    @NonNull
    private static List<StockBasic> stockBasicsOf(StockBasic... basics) {
        return Objects.requireNonNull(List.of(basics), "stock basics list must not be null");
    }

    @NonNull
    private static List<StockBasic> emptyStockBasics() {
        return Objects.requireNonNull(List.<StockBasic>of(), "stock basics list must not be null");
    }
}
