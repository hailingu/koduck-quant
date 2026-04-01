package com.koduck.service;

import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.entity.StockBasic;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.StockBasicRepository;
import com.koduck.repository.StockRealtimeRepository;
import com.koduck.service.impl.MarketServiceImpl;
import com.koduck.service.support.MarketFallbackSupport;
import com.koduck.service.support.MarketServiceSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.lang.NonNull;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link MarketServiceImpl}.
 *
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@ExtendWith(MockitoExtension.class)
class MarketServiceImplTest {

    @Mock
    private StockRealtimeRepository stockRealtimeRepository;

    @Mock
    private StockBasicRepository stockBasicRepository;

    @Mock
    private StockCacheService stockCacheService;

        @Mock
        private MarketFallbackSupport marketFallbackSupport;

    private MarketServiceImpl marketService;

    @BeforeEach
    void setUp() {
        MarketServiceSupport marketServiceSupport =
                new MarketServiceSupport(stockRealtimeRepository, stockBasicRepository);
        marketService = new MarketServiceImpl(
                stockRealtimeRepository,
                stockBasicRepository,
                stockCacheService,
                marketServiceSupport,
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
                .volume(125800L)
                .amount(new BigDecimal("1201500.00"))
                .build();

        when(stockBasicRepository.searchByKeyword("永太", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(stockBasicsOf(basic)));
        when(stockRealtimeRepository.findBySymbolIn(List.of("002326")))
                .thenReturn(List.of(realtime));

        List<SymbolInfoDto> results = marketService.searchSymbols("永太", 1, 20);

        assertThat(results).hasSize(1);
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

        when(stockBasicRepository.searchByKeyword("京泉华", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(stockBasicsOf(shortCode, canonicalCode)));
        when(stockRealtimeRepository.findBySymbolIn(List.of("2885", "002885")))
                .thenReturn(List.of(realtime));

        List<SymbolInfoDto> results = marketService.searchSymbols("京泉华", 1, 20);

        assertThat(results).hasSize(1);
        assertThat(results.get(0).symbol()).isEqualTo("002885");
        assertThat(results.get(0).name()).isEqualTo("京泉华");
    }

    @Test
    @DisplayName("shouldReturnEmptyListWhenSearchParamsAreInvalid")
    void shouldReturnEmptyListWhenSearchParamsAreInvalid() {
        List<SymbolInfoDto> results = marketService.searchSymbols("", 1, 20);

        assertThat(results).isEmpty();
    }

    @Test
    @DisplayName("shouldFallbackToDataServiceWhenDatabaseSearchReturnsEmpty")
    void shouldFallbackToDataServiceWhenDatabaseSearchReturnsEmpty() {
        when(stockBasicRepository.searchByKeyword("隆基", PageRequest.of(0, 5)))
                .thenReturn(new PageImpl<>(emptyStockBasics()));
        when(marketFallbackSupport.searchSymbolsFromProvider("隆基", 5))
                .thenReturn(List.of(
                        SymbolInfoDto.builder().symbol("601012").name("隆基绿能").market("AShare").type("STOCK")
                                .build(),
                        SymbolInfoDto.builder().symbol("002363").name("隆基机械").market("AShare").type("STOCK")
                                .build()
                ));

        List<SymbolInfoDto> results = marketService.searchSymbols("隆基", 1, 5);

        assertThat(results).hasSize(2);
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
                .volume(125800L)
                .amount(new BigDecimal("1201500.00"))
                .changeAmount(new BigDecimal("0.22"))
                .changePercent(new BigDecimal("2.36"))
                .updatedAt(LocalDateTime.now())
                .build();

        when(stockRealtimeRepository.findFirstBySymbolOrderByUpdatedAtDesc("002326")).thenReturn(Optional.of(realtime));

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
                                1741348800L,
                                new BigDecimal("12.10"),
                                new BigDecimal("12.35"),
                                new BigDecimal("11.98"),
                                new BigDecimal("12.28"),
                                258000L,
                                new BigDecimal("3158200.00"));

                when(stockRealtimeRepository.findFirstBySymbolOrderByUpdatedAtDesc("002885")).thenReturn(Optional.empty());
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
                previous.put("timestamp", 1741262400L);
                previous.put("open", "15.20");
                previous.put("high", "15.50");
                previous.put("low", "15.10");
                previous.put("close", "15.30");
                previous.put("volume", 1200000L);
                previous.put("amount", "18360000.00");

                Map<String, Object> latest = new LinkedHashMap<>();
                latest.put("timestamp", 1741348800L);
                latest.put("open", "15.31");
                latest.put("high", "15.60");
                latest.put("low", "15.20");
                latest.put("close", "15.45");
                latest.put("volume", 1500000L);
                latest.put("amount", "23175000.00");

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

                when(stockRealtimeRepository.findFirstBySymbolOrderByUpdatedAtDesc("002885")).thenReturn(Optional.empty());
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

        when(stockRealtimeRepository.findBySymbolInAndType(List.of("000001", "399001", "399006"), "INDEX"))
                .thenReturn(List.of(index));

        List<MarketIndexDto> indices = marketService.getMarketIndices();

        assertThat(indices).hasSize(1);
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

        assertThat(quotes).hasSize(2);
        assertThat(quotes.get(0).symbol()).isEqualTo("002326");
        assertThat(quotes.get(1).symbol()).isEqualTo("000001");
        verify(stockCacheService).cacheBatchStockTracks(org.mockito.ArgumentMatchers.<List<PriceQuoteDto>>any());
    }

    @Test
    @DisplayName("shouldReturnEmptyListWhenBatchSymbolsIsEmpty")
    void shouldReturnEmptyListWhenBatchSymbolsIsEmpty() {
        List<PriceQuoteDto> quotes = marketService.getBatchPrices(List.of());

        assertThat(quotes).isEmpty();
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
