package com.koduck.controller.market;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

import jakarta.validation.constraints.Size;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.koduck.common.constants.ApiMessageConstants;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.KlineService;
import com.koduck.service.KlineSyncService;
import com.koduck.service.MarketBreadthService;
import com.koduck.service.MarketFlowService;
import com.koduck.service.MarketService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * MarketController 单元测试类。
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
class MarketControllerTest {

    /** 默认页码。 */
    private static final int DEFAULT_PAGE = 1;

    /** 默认页面大小。 */
    private static final int DEFAULT_PAGE_SIZE = 20;

    /** 测试股票代码 - 永太科技。 */
    private static final String SYMBOL_YONGTAI = "002326";

    /** 测试股票代码 - 隆基绿能。 */
    private static final String SYMBOL_LONGJI = "601012";

    /** 测试股票代码 - 不存在的代码。 */
    private static final String SYMBOL_NON_EXISTENT = "999999";

    /** 测试股票代码 - 上证指数。 */
    private static final String SYMBOL_SH_INDEX = "000001";

    /** 测试市场类型 - A股。 */
    private static final String MARKET_A_SHARE = "AShare";

    /** K线周期 - 1日。 */
    private static final String TIMEFRAME_1D = "1D";

    /** K线数据限制数量。 */
    private static final int KLINE_LIMIT = 100;

    /** HTTP状态码 - 成功。 */
    private static final int HTTP_OK = 0;

    /** HTTP状态码 - 未找到。 */
    private static final int HTTP_NOT_FOUND = 404;

    /** 批量查询最大数量。 */
    private static final int BATCH_MAX_SIZE = 50;

    /** 价格数值常量 - 9.55。 */
    private static final BigDecimal PRICE_9_55 = new BigDecimal("9.55");

    /** 价格数值常量 - 9.35。 */
    private static final BigDecimal PRICE_9_35 = new BigDecimal("9.35");

    /** 价格数值常量 - 9.68。 */
    private static final BigDecimal PRICE_9_68 = new BigDecimal("9.68");

    /** 价格数值常量 - 9.30。 */
    private static final BigDecimal PRICE_9_30 = new BigDecimal("9.30");

    /** 价格数值常量 - 9.33。 */
    private static final BigDecimal PRICE_9_33 = new BigDecimal("9.33");

    /** 成交量 - 125800。 */
    private static final long VOLUME_125800 = 125800L;

    /** 成交额 - 1201500.0。 */
    private static final BigDecimal AMOUNT_1201500 = new BigDecimal("1201500.0");

    /** 涨跌额 - 0.22。 */
    private static final BigDecimal CHANGE_0_22 = new BigDecimal("0.22");

    /** 涨跌幅 - 2.36%。 */
    private static final BigDecimal CHANGE_PERCENT_2_36 = new BigDecimal("2.36");

    /** 涨跌幅 - 2.35%。 */
    private static final BigDecimal CHANGE_PERCENT_2_35 = new BigDecimal("2.35");

    /** 市盈率 - 18.39。 */
    private static final BigDecimal PE_TTM_18_39 = new BigDecimal("18.39");

    /** 市净率 - 2.17。 */
    private static final BigDecimal PB_2_17 = new BigDecimal("2.17");

    /** 市值 - 1393.52。 */
    private static final BigDecimal MARKET_CAP_1393_52 = new BigDecimal("1393.52");

    /** 上证指数价格 - 3250.68。 */
    private static final BigDecimal INDEX_PRICE_3250_68 = new BigDecimal("3250.68");

    /** 指数涨跌额 - 25.35。 */
    private static final BigDecimal INDEX_CHANGE_25_35 = new BigDecimal("25.35");

    /** 指数涨跌幅 - 0.78%。 */
    private static final BigDecimal INDEX_CHANGE_PERCENT_0_78 = new BigDecimal("0.78");

    /** K线时间戳 - 2024-01-01。 */
    private static final long KLINE_TIMESTAMP = 1704067200000L;

    /** K线开盘价 - 12.30。 */
    private static final BigDecimal KLINE_OPEN_12_30 = new BigDecimal("12.30");

    /** K线最高价 - 12.80。 */
    private static final BigDecimal KLINE_HIGH_12_80 = new BigDecimal("12.80");

    /** K线最低价 - 12.20。 */
    private static final BigDecimal KLINE_LOW_12_20 = new BigDecimal("12.20");

    /** K线收盘价 - 12.50。 */
    private static final BigDecimal KLINE_CLOSE_12_50 = new BigDecimal("12.50");

    /** K线成交量 - 1000000。 */
    private static final long KLINE_VOLUME = 1000000L;

    /** K线成交额 - 12500000。 */
    private static final BigDecimal KLINE_AMOUNT = new BigDecimal("12500000");

    /** Mock MarketService。 */
    @Mock
    private MarketService marketService;

    /** Mock MarketFlowService。 */
    @Mock
    private MarketFlowService marketFlowService;

    /** Mock MarketBreadthService。 */
    @Mock
    private MarketBreadthService marketBreadthService;

    /** Mock KlineService。 */
    @Mock
    private KlineService klineService;

    /** Mock KlineSyncService。 */
    @Mock
    private KlineSyncService klineSyncService;

    /** 被测试的 MarketController 实例。 */
    @InjectMocks
    private MarketController marketController;

    /** MockMvc 实例用于测试 HTTP 请求。 */
    private MockMvc mockMvc;

    /**
     * 测试前的初始化设置。
     */
    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(marketController).build();
    }

    /**
     * 测试股票搜索功能 - 正常返回结果。
     *
     * @throws Exception 当测试执行异常时抛出
     */
    @Test
    @DisplayName("股票搜索 - 正常返回结果")
    void searchSymbolsShouldReturnResults() throws Exception {
        // Given
        SymbolInfoDto symbol = SymbolInfoDto.builder()
                .symbol(SYMBOL_YONGTAI)
                .name("永太科技")
                .market(MARKET_A_SHARE)
                .price(PRICE_9_55)
                .changePercent(CHANGE_PERCENT_2_35)
                .build();

        when(marketService.searchSymbols("永太", DEFAULT_PAGE, DEFAULT_PAGE_SIZE))
                .thenReturn(List.of(symbol));

        // When & Then
        mockMvc.perform(get("/api/v1/market/search")
                        .param("keyword", "永太")
                        .param("page", String.valueOf(DEFAULT_PAGE))
                        .param("size", String.valueOf(DEFAULT_PAGE_SIZE))
                        .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_OK))
                .andExpect(jsonPath("$.data[0].symbol").value(SYMBOL_YONGTAI))
                .andExpect(jsonPath("$.data[0].name").value("永太科技"));

        verify(marketService).searchSymbols("永太", DEFAULT_PAGE, DEFAULT_PAGE_SIZE);
    }

    /**
     * 测试股票搜索功能 - 空关键词返回空结果。
     *
     * @throws Exception 当测试执行异常时抛出
     */
    @Test
    @DisplayName("股票搜索 - 空关键词返回空结果")
    void searchSymbolsWithEmptyKeywordReturnsEmpty() throws Exception {
        // Given - empty keyword returns empty list
        when(marketService.searchSymbols("", DEFAULT_PAGE, DEFAULT_PAGE_SIZE))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/v1/market/search")
                        .param("keyword", "")
                        .param("page", String.valueOf(DEFAULT_PAGE))
                        .param("size", String.valueOf(DEFAULT_PAGE_SIZE))
                        .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_OK))
                .andExpect(jsonPath("$.data").isArray());

        verify(marketService).searchSymbols("", DEFAULT_PAGE, DEFAULT_PAGE_SIZE);
    }

    /**
     * 测试获取股票详情功能 - 正常返回。
     *
     * @throws Exception 当测试执行异常时抛出
     */
    @Test
    @DisplayName("股票详情 - 正常返回")
    void getStockDetailShouldReturnQuote() throws Exception {
        // Given
        PriceQuoteDto quote = PriceQuoteDto.builder()
                .symbol(SYMBOL_YONGTAI)
                .name("永太科技")
                .price(PRICE_9_55)
                .open(PRICE_9_35)
                .high(PRICE_9_68)
                .low(PRICE_9_30)
                .prevClose(PRICE_9_33)
                .volume(VOLUME_125800)
                .amount(AMOUNT_1201500)
                .change(CHANGE_0_22)
                .changePercent(CHANGE_PERCENT_2_36)
                .timestamp(Instant.now())
                .build();

        when(marketService.getStockDetail(SYMBOL_YONGTAI)).thenReturn(quote);

        // When & Then
        mockMvc.perform(get("/api/v1/market/stocks/" + SYMBOL_YONGTAI)
                        .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_OK))
                .andExpect(jsonPath("$.data.symbol").value(SYMBOL_YONGTAI))
                .andExpect(jsonPath("$.data.name").value("永太科技"));

        verify(marketService).getStockDetail(SYMBOL_YONGTAI);
    }

    /**
     * 测试获取股票详情功能 - 不存在的股票应返回404。
     *
     * @throws Exception 当测试执行异常时抛出
     */
    @Test
    @DisplayName("股票详情 - 不存在的股票应返回404")
    void getStockDetailWithNonExistentSymbolShouldReturn404() throws Exception {
        when(marketService.getStockDetail(SYMBOL_NON_EXISTENT)).thenReturn(null);

        mockMvc.perform(get("/api/v1/market/stocks/" + SYMBOL_NON_EXISTENT)
                        .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_NOT_FOUND));

        verify(marketService).getStockDetail(SYMBOL_NON_EXISTENT);
    }

    /**
     * 测试获取股票估值功能 - 正常返回。
     *
     * @throws Exception 当测试执行异常时抛出
     */
    @Test
    @DisplayName("股票估值 - 正常返回")
    void getStockValuationShouldReturnValuation() throws Exception {
        StockValuationDto valuation = StockValuationDto.builder()
                .symbol(SYMBOL_LONGJI)
                .name("隆基绿能")
                .peTtm(PE_TTM_18_39)
                .pb(PB_2_17)
                .marketCap(MARKET_CAP_1393_52)
                .build();

        when(marketService.getStockValuation(SYMBOL_LONGJI)).thenReturn(valuation);

        mockMvc.perform(get("/api/v1/market/stocks/" + SYMBOL_LONGJI + "/valuation")
                        .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_OK))
                .andExpect(jsonPath("$.data.symbol").value(SYMBOL_LONGJI))
                .andExpect(jsonPath("$.data.pe_ttm").value(PE_TTM_18_39))
                .andExpect(jsonPath("$.data.pb").value(PB_2_17));

        verify(marketService).getStockValuation(SYMBOL_LONGJI);
    }

    /**
     * 测试获取股票行业信息功能 - 正常返回。
     *
     * @throws Exception 当测试执行异常时抛出
     */
    @Test
    @DisplayName("股票行业 - 正常返回")
    void getStockIndustryShouldReturnIndustry() throws Exception {
        StockIndustryDto industry = StockIndustryDto.builder()
                .symbol(SYMBOL_LONGJI)
                .name("隆基绿能")
                .industry("电力设备")
                .sector("新能源")
                .subIndustry("光伏设备")
                .board("主板")
                .build();

        when(marketService.getStockIndustry(SYMBOL_LONGJI)).thenReturn(industry);

        mockMvc.perform(get("/api/v1/market/stocks/" + SYMBOL_LONGJI + "/industry")
                        .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_OK))
                .andExpect(jsonPath("$.data.symbol").value(SYMBOL_LONGJI))
                .andExpect(jsonPath("$.data.industry").value("电力设备"))
                .andExpect(jsonPath("$.data.sub_industry").value("光伏设备"));

        verify(marketService).getStockIndustry(SYMBOL_LONGJI);
    }

    /**
     * 测试获取市场指数功能 - 正常返回。
     *
     * @throws Exception 当测试执行异常时抛出
     */
    @Test
    @DisplayName("市场指数 - 正常返回")
    void getMarketIndicesShouldReturnIndices() throws Exception {
        // Given
        MarketIndexDto index = MarketIndexDto.builder()
                .symbol(SYMBOL_SH_INDEX)
                .name("上证指数")
                .price(INDEX_PRICE_3250_68)
                .change(INDEX_CHANGE_25_35)
                .changePercent(INDEX_CHANGE_PERCENT_0_78)
                .timestamp(Instant.now())
                .build();

        when(marketService.getMarketIndices()).thenReturn(List.of(index));

        // When & Then
        mockMvc.perform(get("/api/v1/market/indices")
                        .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_OK))
                .andExpect(jsonPath("$.data[0].symbol").value(SYMBOL_SH_INDEX))
                .andExpect(jsonPath("$.data[0].name").value("上证指数"));

        verify(marketService).getMarketIndices();
    }

    /**
     * 测试获取K线数据功能 - 已有数据时返回200。
     *
     * @throws Exception 当测试执行异常时抛出
     */
    @Test
    @DisplayName("K线数据 - 已有数据时返回200")
    void getStockKlineWithAvailableDataShouldReturnOk() throws Exception {
        KlineDataDto klineData = KlineDataDto.builder()
                .timestamp(KLINE_TIMESTAMP)
                .open(KLINE_OPEN_12_30)
                .high(KLINE_HIGH_12_80)
                .low(KLINE_LOW_12_20)
                .close(KLINE_CLOSE_12_50)
                .volume(KLINE_VOLUME)
                .amount(KLINE_AMOUNT)
                .build();
        when(klineService.getKlineData(
                MARKET_A_SHARE, SYMBOL_SH_INDEX, TIMEFRAME_1D, KLINE_LIMIT, null
        )).thenReturn(List.of(klineData));

        mockMvc.perform(get("/api/v1/market/stocks/{symbol}/kline", SYMBOL_SH_INDEX)
                        .param("market", MARKET_A_SHARE)
                        .param("timeframe", TIMEFRAME_1D)
                        .param("limit", String.valueOf(KLINE_LIMIT))
                        .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_OK))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].close").value(KLINE_CLOSE_12_50));

        verify(klineService).getKlineData(
                MARKET_A_SHARE, SYMBOL_SH_INDEX, TIMEFRAME_1D, KLINE_LIMIT, null
        );
        verifyNoInteractions(klineSyncService);
    }

    /**
     * 测试获取K线数据功能 - 触发异步同步时返回202。
     *
     * @throws Exception 当测试执行异常时抛出
     */
    @Test
    @DisplayName("K线数据 - 触发异步同步时返回202")
    void getStockKlineWhenSyncTriggeredShouldReturnAccepted() throws Exception {
        when(klineService.getKlineData(
                MARKET_A_SHARE, SYMBOL_SH_INDEX, TIMEFRAME_1D, KLINE_LIMIT, null
        )).thenReturn(List.of());
        when(klineSyncService.requestSyncSymbolKline(
                MARKET_A_SHARE, SYMBOL_SH_INDEX, TIMEFRAME_1D
        )).thenReturn(true);

        mockMvc.perform(get("/api/v1/market/stocks/{symbol}/kline", SYMBOL_SH_INDEX)
                        .param("market", MARKET_A_SHARE)
                        .param("timeframe", TIMEFRAME_1D)
                        .param("limit", String.valueOf(KLINE_LIMIT))
                        .contentType(jsonMediaType()))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.code").value(HTTP_OK))
                .andExpect(jsonPath("$.message")
                        .value(ApiMessageConstants.KLINE_SYNC_ACCEPTED))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());

        verify(klineService).getKlineData(
                MARKET_A_SHARE, SYMBOL_SH_INDEX, TIMEFRAME_1D, KLINE_LIMIT, null
        );
        verify(klineSyncService).requestSyncSymbolKline(
                MARKET_A_SHARE, SYMBOL_SH_INDEX, TIMEFRAME_1D
        );
    }

    /**
     * 测试批量行情功能 - 参数应声明最多50个股票代码。
     *
     * @throws NoSuchMethodException 当方法不存在时抛出
     */
    @Test
    @DisplayName("批量行情 - 参数应声明最多50个股票代码（高级控制器）")
    void getBatchPricesShouldDeclareMaxSizeConstraint() throws NoSuchMethodException {
        Method method = MarketAdvancedController.class.getMethod(
                "getBatchPrices", List.class
        );
        Size size = method.getParameters()[0].getAnnotation(Size.class);

        assertNotNull(size);
        assertEquals(BATCH_MAX_SIZE, size.max());
    }

    /**
     * 获取 JSON MediaType。
     *
     * @return application/json MediaType
     */
    private static @NonNull MediaType jsonMediaType() {
        return Objects.requireNonNull(
                MediaType.APPLICATION_JSON,
                "application/json media type must not be null"
        );
    }

}
