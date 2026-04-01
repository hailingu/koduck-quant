package com.koduck.controller;

import com.koduck.common.constants.ApiMessageConstants;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.KlineSyncService;
import com.koduck.service.KlineService;
import com.koduck.service.MarketBreadthService;
import com.koduck.service.MarketFlowService;
import com.koduck.service.MarketService;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.lang.NonNull;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class MarketControllerTest {

    @Mock
    private MarketService marketService;

    @Mock
    private MarketFlowService marketFlowService;

    @Mock
    private MarketBreadthService marketBreadthService;

    @Mock
    private KlineService klineService;

    @Mock
    private KlineSyncService klineSyncService;

    @InjectMocks
    private MarketController marketController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(marketController).build();
    }

    @Test
    @DisplayName("股票搜索 - 正常返回结果")
    void searchSymbols_shouldReturnResults() throws Exception {
        // Given
        SymbolInfoDto symbol = SymbolInfoDto.builder()
                .symbol("002326")
                .name("永太科技")
                .market("AShare")
                .price(new BigDecimal("9.55"))
                .changePercent(new BigDecimal("2.35"))
                .build();
        
        when(marketService.searchSymbols("永太", 1, 20)).thenReturn(List.of(symbol));

        // When & Then
        mockMvc.perform(get("/api/v1/market/search")
                .param("keyword", "永太")
                .param("page", "1")
                .param("size", "20")
                .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].symbol").value("002326"))
                .andExpect(jsonPath("$.data[0].name").value("永太科技"));

        verify(marketService).searchSymbols("永太", 1, 20);
    }

    @Test
    @DisplayName("股票搜索 - 空关键词返回空结果")
    void searchSymbols_withEmptyKeyword_returnsEmpty() throws Exception {
        // Given - empty keyword returns empty list
        when(marketService.searchSymbols("", 1, 20)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/market/search")
                .param("keyword", "")
                .param("page", "1")
                .param("size", "20")
                .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray());

        verify(marketService).searchSymbols("", 1, 20);
    }

    @Test
    @DisplayName("股票详情 - 正常返回")
    void getStockDetail_shouldReturnQuote() throws Exception {
        // Given
        PriceQuoteDto quote = PriceQuoteDto.builder()
                .symbol("002326")
                .name("永太科技")
                .price(new BigDecimal("9.55"))
                .open(new BigDecimal("9.35"))
                .high(new BigDecimal("9.68"))
                .low(new BigDecimal("9.30"))
                .prevClose(new BigDecimal("9.33"))
                .volume(125800L)
                .amount(new BigDecimal("1201500.0"))
                .change(new BigDecimal("0.22"))
                .changePercent(new BigDecimal("2.36"))
                .timestamp(Instant.now())
                .build();

        when(marketService.getStockDetail("002326")).thenReturn(quote);

        // When & Then
        mockMvc.perform(get("/api/v1/market/stocks/002326")
                .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.symbol").value("002326"))
                .andExpect(jsonPath("$.data.name").value("永太科技"));

        verify(marketService).getStockDetail("002326");
    }

    @Test
    @DisplayName("股票详情 - 不存在的股票应返回404")
    void getStockDetail_withNonExistentSymbol_shouldReturn404() throws Exception {
        when(marketService.getStockDetail("999999")).thenReturn(null);

        mockMvc.perform(get("/api/v1/market/stocks/999999")
                .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));

        verify(marketService).getStockDetail("999999");
    }

        @Test
        @DisplayName("股票估值 - 正常返回")
        void getStockValuation_shouldReturnValuation() throws Exception {
                StockValuationDto valuation = StockValuationDto.builder()
                                .symbol("601012")
                                .name("隆基绿能")
                                .peTtm(new BigDecimal("18.39"))
                                .pb(new BigDecimal("2.17"))
                                .marketCap(new BigDecimal("1393.52"))
                                .build();

                when(marketService.getStockValuation("601012")).thenReturn(valuation);

                mockMvc.perform(get("/api/v1/market/stocks/601012/valuation")
                                .contentType(jsonMediaType()))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.code").value(0))
                                .andExpect(jsonPath("$.data.symbol").value("601012"))
                        .andExpect(jsonPath("$.data.pe_ttm").value(18.39))
                                .andExpect(jsonPath("$.data.pb").value(2.17));

                verify(marketService).getStockValuation("601012");
        }

        @Test
        @DisplayName("股票行业 - 正常返回")
        void getStockIndustry_shouldReturnIndustry() throws Exception {
                StockIndustryDto industry = StockIndustryDto.builder()
                                .symbol("601012")
                                .name("隆基绿能")
                                .industry("电力设备")
                                .sector("新能源")
                                .subIndustry("光伏设备")
                                .board("主板")
                                .build();

                when(marketService.getStockIndustry("601012")).thenReturn(industry);

                mockMvc.perform(get("/api/v1/market/stocks/601012/industry")
                                                .contentType(jsonMediaType()))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.code").value(0))
                                .andExpect(jsonPath("$.data.symbol").value("601012"))
                                .andExpect(jsonPath("$.data.industry").value("电力设备"))
                                .andExpect(jsonPath("$.data.sub_industry").value("光伏设备"));

                verify(marketService).getStockIndustry("601012");
        }

    @Test
    @DisplayName("市场指数 - 正常返回")
    void getMarketIndices_shouldReturnIndices() throws Exception {
        // Given
        MarketIndexDto index = MarketIndexDto.builder()
                .symbol("000001")
                .name("上证指数")
                .price(new BigDecimal("3250.68"))
                .change(new BigDecimal("25.35"))
                .changePercent(new BigDecimal("0.78"))
                .timestamp(Instant.now())
                .build();

        when(marketService.getMarketIndices()).thenReturn(List.of(index));

        // When & Then
        mockMvc.perform(get("/api/v1/market/indices")
                .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].symbol").value("000001"))
                .andExpect(jsonPath("$.data[0].name").value("上证指数"));

        verify(marketService).getMarketIndices();
    }

    @Test
    @DisplayName("K线数据 - 已有数据时返回200")
    void getStockKline_withAvailableData_shouldReturnOk() throws Exception {
        KlineDataDto klineData = KlineDataDto.builder()
                .timestamp(1704067200000L)
                .open(new BigDecimal("12.30"))
                .high(new BigDecimal("12.80"))
                .low(new BigDecimal("12.20"))
                .close(new BigDecimal("12.50"))
                .volume(1000000L)
                .amount(new BigDecimal("12500000"))
                .build();
        when(klineService.getKlineData("AShare", "000001", "1D", 100, null)).thenReturn(List.of(klineData));

        mockMvc.perform(get("/api/v1/market/stocks/{symbol}/kline", "000001")
                        .param("market", "AShare")
                        .param("timeframe", "1D")
                        .param("limit", "100")
                        .contentType(jsonMediaType()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].close").value(12.50));

        verify(klineService).getKlineData("AShare", "000001", "1D", 100, null);
        verifyNoInteractions(klineSyncService);
    }

    @Test
    @DisplayName("K线数据 - 触发异步同步时返回202")
    void getStockKline_whenSyncTriggered_shouldReturnAccepted() throws Exception {
        when(klineService.getKlineData("AShare", "000001", "1D", 100, null)).thenReturn(List.of());
        when(klineSyncService.requestSyncSymbolKline("AShare", "000001", "1D")).thenReturn(true);

        mockMvc.perform(get("/api/v1/market/stocks/{symbol}/kline", "000001")
                        .param("market", "AShare")
                        .param("timeframe", "1D")
                        .param("limit", "100")
                        .contentType(jsonMediaType()))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value(ApiMessageConstants.KLINE_SYNC_ACCEPTED))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());

        verify(klineService).getKlineData("AShare", "000001", "1D", 100, null);
        verify(klineSyncService).requestSyncSymbolKline("AShare", "000001", "1D");
    }

    @Test
    @DisplayName("批量行情 - 参数应声明最多50个股票代码（高级控制器）")
    void getBatchPrices_shouldDeclareMaxSizeConstraint() throws NoSuchMethodException {
        Method method = MarketAdvancedController.class.getMethod("getBatchPrices", List.class);
        Size size = method.getParameters()[0].getAnnotation(Size.class);

        assertNotNull(size);
        assertEquals(50, size.max());
    }

        private static @NonNull MediaType jsonMediaType() {
                return Objects.requireNonNull(MediaType.APPLICATION_JSON, "application/json media type must not be null");
        }

}
