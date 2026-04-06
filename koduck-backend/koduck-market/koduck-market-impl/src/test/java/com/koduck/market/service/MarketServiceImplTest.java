package com.koduck.market.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.koduck.market.dto.MarketIndexDto;
import com.koduck.market.dto.PriceQuoteDto;
import com.koduck.market.dto.SectorNetworkDto;
import com.koduck.market.dto.StockIndustryDto;
import com.koduck.market.dto.StockStatsDto;
import com.koduck.market.dto.StockValuationDto;
import com.koduck.market.dto.SymbolInfoDto;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * MarketServiceImpl 单元测试。
 *
 * @author Koduck Team
 */
class MarketServiceImplTest {

    /** 默认页码。 */
    private static final int DEFAULT_PAGE = 1;

    /** 默认页大小。 */
    private static final int DEFAULT_SIZE = 10;

    /** 测试目标对象。 */
    private MarketServiceImpl marketService;

    @BeforeEach
    void setUp() {
        marketService = new MarketServiceImpl();
    }

    @Test
    @DisplayName("搜索股票应返回空列表")
    void searchSymbolsShouldReturnEmptyList() {
        List<SymbolInfoDto> result = marketService.searchSymbols("AAPL", DEFAULT_PAGE, DEFAULT_SIZE);

        assertNotNull(result);
        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("获取热门股票应返回空列表")
    void getHotStocksShouldReturnEmptyList() {
        List<SymbolInfoDto> result = marketService.getHotStocks("US", DEFAULT_SIZE);

        assertNotNull(result);
        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("获取股票详情应返回空 Optional")
    void getStockDetailShouldReturnEmptyOptional() {
        Optional<PriceQuoteDto> result = marketService.getStockDetail("AAPL");

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("获取股票估值应返回空 Optional")
    void getStockValuationShouldReturnEmptyOptional() {
        Optional<StockValuationDto> result = marketService.getStockValuation("AAPL");

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("获取股票行业信息应返回空 Optional")
    void getStockIndustryShouldReturnEmptyOptional() {
        Optional<StockIndustryDto> result = marketService.getStockIndustry("AAPL");

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("批量获取股票行业信息应返回空 Map")
    void getStockIndustriesShouldReturnEmptyMap() {
        var result = marketService.getStockIndustries(Collections.singletonList("AAPL"));

        assertNotNull(result);
        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("获取市场指数应返回空列表")
    void getMarketIndicesShouldReturnEmptyList() {
        List<MarketIndexDto> result = marketService.getMarketIndices();

        assertNotNull(result);
        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("批量获取价格应返回空列表")
    void getBatchPricesShouldReturnEmptyList() {
        List<PriceQuoteDto> result = marketService.getBatchPrices(Collections.singletonList("AAPL"));

        assertNotNull(result);
        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("获取股票统计信息应返回空 Optional")
    void getStockStatsShouldReturnEmptyOptional() {
        Optional<StockStatsDto> result = marketService.getStockStats("AAPL", "US");

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("获取板块网络应返回非空对象")
    void getSectorNetworkShouldReturnNonNull() {
        SectorNetworkDto result = marketService.getSectorNetwork("US");

        assertNotNull(result);
        assertEquals("US", result.market());
    }

    @Test
    @DisplayName("刷新价格缓存应返回 true")
    void refreshPriceCacheShouldReturnTrue() {
        boolean result = marketService.refreshPriceCache("AAPL");

        assertTrue(result);
    }

    @Test
    @DisplayName("批量刷新价格缓存应返回 0")
    void refreshBatchPriceCacheShouldReturnZero() {
        int result = marketService.refreshBatchPriceCache("AAPL,GOOGL");

        assertEquals(0, result);
    }

    @Test
    @DisplayName("清除市场缓存应返回 0")
    void clearMarketCacheShouldReturnZero() {
        int result = marketService.clearMarketCache("US");

        assertEquals(0, result);
    }

    @Test
    @DisplayName("同步市场数据应返回 0")
    void syncMarketDataShouldReturnZero() {
        int result = marketService.syncMarketData("US");

        assertEquals(0, result);
    }
}
