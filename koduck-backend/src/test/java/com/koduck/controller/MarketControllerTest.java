package com.koduck.controller;

import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.MarketService;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class MarketControllerTest {

    @Mock
    private MarketService marketService;

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
                .contentType(MediaType.APPLICATION_JSON))
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
                .contentType(MediaType.APPLICATION_JSON))
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
                .contentType(MediaType.APPLICATION_JSON))
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
                .contentType(MediaType.APPLICATION_JSON))
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
                                .contentType(MediaType.APPLICATION_JSON))
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
                                                .contentType(MediaType.APPLICATION_JSON))
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
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].symbol").value("000001"))
                .andExpect(jsonPath("$.data[0].name").value("上证指数"));

        verify(marketService).getMarketIndices();
    }

    @Test
    @DisplayName("批量行情 - 正常返回")
    void getBatchPrices_shouldReturnQuotes() throws Exception {
        PriceQuoteDto quote = PriceQuoteDto.builder()
                .symbol("000001")
                .name("平安银行")
                .price(new BigDecimal("10.55"))
                .change(new BigDecimal("0.21"))
                .changePercent(new BigDecimal("2.03"))
                .timestamp(Instant.now())
                .build();

        when(marketService.getBatchPrices(List.of("000001", "600000")))
                .thenReturn(List.of(quote));

        mockMvc.perform(get("/api/v1/market/batch")
                .param("symbols", "000001", "600000")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].symbol").value("000001"));

        verify(marketService).getBatchPrices(List.of("000001", "600000"));
    }

    @Test
    @DisplayName("批量行情 - 参数应声明最多50个股票代码")
    void getBatchPrices_shouldDeclareMaxSizeConstraint() throws NoSuchMethodException {
        Method method = MarketController.class.getMethod("getBatchPrices", List.class);
        Size size = method.getParameters()[0].getAnnotation(Size.class);

        assertNotNull(size);
        assertEquals(50, size.max());
    }

}