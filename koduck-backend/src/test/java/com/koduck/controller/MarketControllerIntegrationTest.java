package com.koduck.controller;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.koduck.AbstractIntegrationTest;
import com.koduck.entity.StockBasic;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.StockBasicRepository;
import com.koduck.repository.StockRealtimeRepository;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;



/**
 * Integration tests for {@link MarketController}.
 * <p>Tests market data endpoints including symbol search, stock details,
 * market indices, and batch operations.</p>
 *
 * @author Koduck Team
 */
@AutoConfigureMockMvc
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class MarketControllerIntegrationTest extends AbstractIntegrationTest {

    /** HTTP status code: Bad Request (400). */
    private static final int HTTP_BAD_REQUEST = 400;

    /** HTTP status code: Not Found (404). */
    private static final int HTTP_NOT_FOUND = 404;

    /** HTTP status code: Created (201). */
    private static final int HTTP_CREATED = 201;

    /** Maximum keyword length for search validation. */
    private static final int MAX_KEYWORD_LENGTH = 51;

    /** Maximum batch size for industry request. */
    private static final int MAX_BATCH_SIZE = 201;

    /** Test stock price for 平安银行. */
    private static final BigDecimal PRICE_PINGAN = new BigDecimal("12.50");

    /** Test stock change percent for 平安银行. */
    private static final BigDecimal CHANGE_PERCENT_PINGAN = new BigDecimal("0.81");

    /** Test stock volume for 平安银行. */
    private static final long VOLUME_PINGAN = 1000000L;

    /** Test stock price for 万科A. */
    private static final BigDecimal PRICE_VANKE = new BigDecimal("15.60");

    /** Test stock open price for 万科A. */
    private static final BigDecimal OPEN_PRICE_VANKE = new BigDecimal("15.40");

    /** Test stock high price for 万科A. */
    private static final BigDecimal HIGH_PRICE_VANKE = new BigDecimal("15.80");

    /** Test stock low price for 万科A. */
    private static final BigDecimal LOW_PRICE_VANKE = new BigDecimal("15.30");

    /** Test stock volume for 万科A. */
    private static final long VOLUME_VANKE = 500000L;

    /** MockMvc for performing HTTP requests. */
    private final MockMvc mockMvc;

    /** ObjectMapper for JSON serialization/deserialization. */
    private final ObjectMapper objectMapper;

    /** Repository for StockBasic entities. */
    private final StockBasicRepository stockBasicRepository;

    /** Repository for StockRealtime entities. */
    private final StockRealtimeRepository stockRealtimeRepository;

    @Autowired
    MarketControllerIntegrationTest(
            MockMvc mockMvc,
            ObjectMapper objectMapper,
            StockBasicRepository stockBasicRepository,
            StockRealtimeRepository stockRealtimeRepository) {
        this.mockMvc = mockMvc;
        this.objectMapper = objectMapper;
        this.stockBasicRepository = stockBasicRepository;
        this.stockRealtimeRepository = stockRealtimeRepository;
    }

    @BeforeEach
    void setUp() {
        // Clean and setup test data
        stockRealtimeRepository.deleteAll();
        stockBasicRepository.deleteAll();
    }

    // ==================== Symbol Search Tests ====================

    @Test
    @DisplayName("搜索股票-正常结果")
    void searchSymbolsWithResults() throws Exception {
        // Prepare test data
        StockBasic stock = StockBasic.builder()
                .symbol("600519")
                .name("贵州茅台")
                .type("STOCK")
                .market("AShare")
                .build();
        stockBasicRepository.save(stock);

        mockMvc.perform(get("/api/v1/market/search")
                        .param("keyword", "茅台")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].symbol").value("600519"))
                .andExpect(jsonPath("$.data[0].name").value("贵州茅台"));
    }

    @Test
    @DisplayName("搜索股票-空结果")
    void searchSymbolsEmptyResult() throws Exception {
        mockMvc.perform(get("/api/v1/market/search")
                        .param("keyword", "不存在的股票")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @DisplayName("搜索股票-参数验证失败-空关键词")
    void searchSymbolsValidationEmptyKeyword() throws Exception {
        mockMvc.perform(get("/api/v1/market/search")
                        .param("keyword", "")
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(HTTP_BAD_REQUEST));
    }

    @Test
    @DisplayName("搜索股票-参数验证失败-关键词过长")
    void searchSymbolsValidationLongKeyword() throws Exception {
        String longKeyword = "a".repeat(MAX_KEYWORD_LENGTH);
        mockMvc.perform(get("/api/v1/market/search")
                        .param("keyword", longKeyword)
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(HTTP_BAD_REQUEST));
    }

    // ==================== Stock Detail Tests ====================

    @Test
    @DisplayName("获取股票详情-存在")
    void getStockDetailExists() throws Exception {
        // Prepare test data
        StockRealtime stockRealtime = StockRealtime.builder()
                .symbol("000001")
                .name("平安银行")
                .type("STOCK")
                .price(PRICE_PINGAN)
                .openPrice(new BigDecimal("12.30"))
                .high(new BigDecimal("12.80"))
                .low(new BigDecimal("12.20"))
                .prevClose(new BigDecimal("12.40"))
                .volume(VOLUME_PINGAN)
                .amount(new BigDecimal("12500000"))
                .changeAmount(new BigDecimal("0.10"))
                .changePercent(CHANGE_PERCENT_PINGAN)
                .build();
        stockRealtimeRepository.save(stockRealtime);

        mockMvc.perform(get("/api/v1/market/stocks/{symbol}", "000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.symbol").value("000001"))
                .andExpect(jsonPath("$.data.name").value("平安银行"))
                .andExpect(jsonPath("$.data.price").value(PRICE_PINGAN.doubleValue()))
                .andExpect(jsonPath("$.data.changePercent").value(CHANGE_PERCENT_PINGAN.doubleValue()));
    }

    @Test
    @DisplayName("获取股票详情-不存在")
    void getStockDetailNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/market/stocks/{symbol}", "999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_NOT_FOUND))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("获取股票详情-参数验证失败-空symbol")
    void getStockDetailValidationEmptySymbol() throws Exception {
        mockMvc.perform(get("/api/v1/market/stocks/{symbol}", "  "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(HTTP_BAD_REQUEST));
    }

    // ==================== Market Indices Tests ====================

    @Test
    @DisplayName("获取市场指数-有数据")
    void getMarketIndicesWithData() throws Exception {
        // Prepare test data for indices
        StockRealtime shIndex = StockRealtime.builder()
                .symbol("000001")
                .name("上证指数")
                .type("INDEX")
                .price(new BigDecimal("3050.50"))
                .changeAmount(new BigDecimal("15.30"))
                .changePercent(new BigDecimal("0.50"))
                .build();
        stockRealtimeRepository.save(shIndex);

        mockMvc.perform(get("/api/v1/market/indices"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("获取市场指数-无数据返回空数组")
    void getMarketIndicesEmpty() throws Exception {
        mockMvc.perform(get("/api/v1/market/indices"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray());
    }

    // ==================== Stock Stats Tests ====================

    @Test
    @DisplayName("获取股票统计-存在")
    void getStockStatsExists() throws Exception {
        // Prepare test data
        StockRealtime stockRealtime = StockRealtime.builder()
                .symbol("000002")
                .name("万科A")
                .type("STOCK")
                .price(PRICE_VANKE)
                .openPrice(OPEN_PRICE_VANKE)
                .high(HIGH_PRICE_VANKE)
                .low(LOW_PRICE_VANKE)
                .prevClose(new BigDecimal("15.50"))
                .volume(VOLUME_VANKE)
                .amount(new BigDecimal("7800000"))
                .build();
        stockRealtimeRepository.save(stockRealtime);

        mockMvc.perform(get("/api/v1/market/stocks/{symbol}/stats", "000002")
                        .param("market", "AShare"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.symbol").value("000002"))
                .andExpect(jsonPath("$.data.open").value(OPEN_PRICE_VANKE.doubleValue()))
                .andExpect(jsonPath("$.data.high").value(HIGH_PRICE_VANKE.doubleValue()))
                .andExpect(jsonPath("$.data.low").value(LOW_PRICE_VANKE.doubleValue()))
                .andExpect(jsonPath("$.data.current").value(PRICE_VANKE.doubleValue()));
    }

    @Test
    @DisplayName("获取股票统计-不存在")
    void getStockStatsNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/market/stocks/{symbol}/stats", "999998")
                        .param("market", "AShare"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_NOT_FOUND));
    }

    // ==================== Stock Industry Tests ====================

    @Test
    @DisplayName("获取股票行业信息-触发外部服务路径")
    void getStockIndustry() throws Exception {
        // This will trigger fallback to data service path
        // Since external service is not available in test, it should return 404
        mockMvc.perform(get("/api/v1/market/stocks/{symbol}/industry", "600519"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_NOT_FOUND));
    }

    @Test
    @DisplayName("批量获取股票行业信息-空列表")
    void getStockIndustriesEmptyList() throws Exception {
        mockMvc.perform(post("/api/v1/market/stocks/industry/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(HTTP_BAD_REQUEST));
    }

    @Test
    @DisplayName("批量获取股票行业信息-列表过大")
    void getStockIndustriesListTooLarge() throws Exception {
        List<String> symbols = java.util.Collections.nCopies(MAX_BATCH_SIZE, "600519");
        mockMvc.perform(post("/api/v1/market/stocks/industry/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(symbols)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(HTTP_BAD_REQUEST));
    }

    // ==================== Kline Tests ====================

    @Test
    @DisplayName("获取K线数据-空结果")
    void getStockKlineEmpty() throws Exception {
        mockMvc.perform(get("/api/v1/market/stocks/{symbol}/kline", "000001")
                        .param("market", "AShare")
                        .param("timeframe", "1D")
                        .param("limit", "100"))
                .andExpect(status().is2xxSuccessful())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("获取K线数据-参数验证失败-无效limit")
    void getStockKlineInvalidLimit() throws Exception {
        mockMvc.perform(get("/api/v1/market/stocks/{symbol}/kline", "000001")
                        .param("market", "AShare")
                        .param("limit", "1001"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(HTTP_BAD_REQUEST));
    }

    // ==================== Batch Prices Tests ====================

    @Test
    @DisplayName("批量获取股票价格-通过query参数")
    void getBatchPrices() throws Exception {
        // Prepare test data
        StockRealtime stock1 = StockRealtime.builder()
                .symbol("000001")
                .name("平安银行")
                .type("STOCK")
                .price(PRICE_PINGAN)
                .build();
        StockRealtime stock2 = StockRealtime.builder()
                .symbol("000002")
                .name("万科A")
                .type("STOCK")
                .price(PRICE_VANKE)
                .build();
        stockRealtimeRepository.saveAll(List.of(stock1, stock2));

        mockMvc.perform(get("/api/v1/market/batch-prices")
                        .param("symbols", "000001,000002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray());
    }

    // ==================== Net Flow Tests ====================

    @Test
    @DisplayName("获取日资金流向-无数据返回404")
    void getDailyNetFlowNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/market/net-flow/daily")
                        .param("market", "AShare")
                        .param("flowType", "total"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_NOT_FOUND));
    }

    @Test
    @DisplayName("获取日资金流向历史-日期范围无效")
    void getDailyNetFlowHistoryInvalidDateRange() throws Exception {
        mockMvc.perform(get("/api/v1/market/net-flow/daily/history")
                        .param("market", "AShare")
                        .param("flowType", "total")
                        .param("from", "2024-03-01")
                        .param("to", "2024-02-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_BAD_REQUEST))
                .andExpect(jsonPath("$.message").exists());
    }

    // ==================== Breadth Tests ====================

    @Test
    @DisplayName("获取日市场宽度-无数据返回404")
    void getDailyBreadthNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/market/breadth/daily")
                        .param("market", "AShare")
                        .param("breadthType", "all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_NOT_FOUND));
    }

    @Test
    @DisplayName("获取日市场宽度历史-日期范围无效")
    void getDailyBreadthHistoryInvalidDateRange() throws Exception {
        mockMvc.perform(get("/api/v1/market/breadth/daily/history")
                        .param("market", "AShare")
                        .param("breadthType", "all")
                        .param("from", "2024-03-01")
                        .param("to", "2024-02-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(HTTP_BAD_REQUEST))
                .andExpect(jsonPath("$.message").exists());
    }
}
