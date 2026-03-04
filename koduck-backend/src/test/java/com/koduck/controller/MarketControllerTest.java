package com.koduck.controller;

import com.koduck.dto.market.HotStockType;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.MarketService;
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
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
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
    @DisplayName("热门股票 - 按成交量排序")
    void getHotStocks_byVolume_shouldReturnStocks() throws Exception {
        // Given
        SymbolInfoDto stock = SymbolInfoDto.builder()
                .symbol("002326")
                .name("永太科技")
                .market("AShare")
                .build();

        when(marketService.getHotStocks(HotStockType.VOLUME, 20)).thenReturn(List.of(stock));

        // When & Then
        mockMvc.perform(get("/api/v1/market/hot")
                .param("type", "volume")
                .param("limit", "20")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].symbol").value("002326"));

        verify(marketService).getHotStocks(HotStockType.VOLUME, 20);
    }

    @Test
    @DisplayName("热门股票 - 按涨幅排序")
    void getHotStocks_byGain_shouldReturnStocks() throws Exception {
        // Given
        SymbolInfoDto stock = SymbolInfoDto.builder()
                .symbol("000001")
                .name("平安银行")
                .market("AShare")
                .build();

        when(marketService.getHotStocks(HotStockType.GAIN, 10)).thenReturn(List.of(stock));

        // When & Then
        mockMvc.perform(get("/api/v1/market/hot")
                .param("type", "gain")
                .param("limit", "10")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        verify(marketService).getHotStocks(HotStockType.GAIN, 10);
    }

    @Test
    @DisplayName("热门股票 - 按跌幅排序")
    void getHotStocks_byLoss_shouldReturnStocks() throws Exception {
        // Given
        SymbolInfoDto stock = SymbolInfoDto.builder()
                .symbol("600000")
                .name("浦发银行")
                .market("AShare")
                .build();

        when(marketService.getHotStocks(HotStockType.LOSS, 15)).thenReturn(List.of(stock));

        // When & Then
        mockMvc.perform(get("/api/v1/market/hot")
                .param("type", "loss")
                .param("limit", "15")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        verify(marketService).getHotStocks(HotStockType.LOSS, 15);
    }
}