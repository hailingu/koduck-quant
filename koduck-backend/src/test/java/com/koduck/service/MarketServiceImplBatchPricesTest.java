package com.koduck.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.market.StockBasicRepository;
import com.koduck.repository.market.StockRealtimeRepository;
import com.koduck.service.impl.MarketServiceImpl;
import com.koduck.service.support.MarketFallbackSupport;
import com.koduck.service.support.MarketServiceSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Unit tests focused on the {@link MarketServiceImpl#getBatchPrices(List)}
 * behaviour.
 *
 * <p>This class exercises the cache-first merging logic: when some symbols
 * are returned from the cache and the remainder are fetched from the
 * repository, the result should preserve the input order and include both
 * sources.</p>
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
class MarketServiceImplBatchPricesTest {

    /** The stock realtime repository. */
    @Mock
    StockRealtimeRepository stockRealtimeRepository;

    /** The stock basic repository. */
    @Mock
    StockBasicRepository stockBasicRepository;

    /** The stock cache service. */
    @Mock
    StockCacheService stockCacheService;

    /** The market service support. */
    @Mock
    MarketServiceSupport marketServiceSupport;

    /** The market fallback support. */
    @Mock
    MarketFallbackSupport marketFallbackSupport;

    /** The market service under test. */
    private MarketServiceImpl marketService;

    @BeforeEach
    void setUp() {
        MarketServiceSupport realMarketServiceSupport =
            new MarketServiceSupport(stockRealtimeRepository, stockBasicRepository);
        marketService = new MarketServiceImpl(
            stockRealtimeRepository,
            stockBasicRepository,
            stockCacheService,
            realMarketServiceSupport,
            marketFallbackSupport);
    }

    /**
     * When part of the requested symbols are already cached and the rest
     * must be loaded from the repository, the returned list should contain
     * both items in the same order as the input argument.
     */
    @Test
    void getBatchPricesShouldMergeCachedAndDb() {
        PriceQuoteDto cached = PriceQuoteDto.builder().symbol("000001").name("A").build();
        StockRealtime dbEntity = new StockRealtime();
        dbEntity.setSymbol("600000");
        dbEntity.setName("B");
        dbEntity.setPrice(new BigDecimal("8.50"));
        dbEntity.setOpenPrice(new BigDecimal("8.50"));
        dbEntity.setHigh(new BigDecimal("8.50"));
        dbEntity.setLow(new BigDecimal("8.50"));
        dbEntity.setPrevClose(new BigDecimal("8.50"));
        dbEntity.setUpdatedAt(LocalDateTime.now());
        when(stockCacheService.getCachedStockTracks(List.of("000001", "600000"))).thenReturn(List.of(cached));
        when(stockRealtimeRepository.findBySymbolIn(List.of("600000"))).thenReturn(List.of(dbEntity));
        List<PriceQuoteDto> result = marketService.getBatchPrices(List.of("000001", "600000"));
        assertThat(result).hasSize(2);
        assertThat(result.get(0).symbol()).isEqualTo("000001");
        assertThat(result.get(1).symbol()).isEqualTo("600000");
    }
}
