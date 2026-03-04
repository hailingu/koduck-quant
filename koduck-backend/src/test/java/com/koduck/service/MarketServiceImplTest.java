package com.koduck.service;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.HotStockType;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.impl.MarketServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * MarketService 单元测试。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MarketServiceImplTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private DataServiceProperties properties;

    private MarketServiceImpl marketService;

    @BeforeEach
    void setUp() {
        lenient().when(properties.isEnabled()).thenReturn(true);
        lenient().when(properties.getBaseUrl()).thenReturn("http://localhost:8000");
        
        marketService = new MarketServiceImpl(restTemplate, properties);
    }

    @SuppressWarnings("unchecked")
    private <T> ParameterizedTypeReference<T> typeRef(Class<T> clazz) {
        return new ParameterizedTypeReference<T>() {};
    }

    @Test
    @DisplayName("股票搜索 - 正常返回结果")
    void searchSymbols_shouldReturnResults() {
        // Given
        List<Map<String, Object>> mockData = new ArrayList<>();
        Map<String, Object> item = new HashMap<>();
        item.put("symbol", "002326");
        item.put("name", "永太科技");
        item.put("market", "AShare");
        item.put("price", 9.55);
        item.put("change_percent", 2.35);
        mockData.add(item);
        
        DataServiceResponse<List<Map<String, Object>>> response = new DataServiceResponse<>(
                200, "success", mockData, Instant.now()
        );
        
        when(restTemplate.exchange(
                anyString(), 
                eq(HttpMethod.GET), 
                isNull(), 
                any(ParameterizedTypeReference.class)))
                .thenReturn(new ResponseEntity<>(response, HttpStatus.OK));

        // When
        List<SymbolInfoDto> results = marketService.searchSymbols("永太", 1, 20);

        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).symbol()).isEqualTo("002326");
        assertThat(results.get(0).name()).isEqualTo("永太科技");
    }

    @Test
    @DisplayName("股票搜索 - 数据服务禁用时返回空列表")
    void searchSymbols_whenDataServiceDisabled_returnsEmptyList() {
        // Given
        when(properties.isEnabled()).thenReturn(false);

        // When
        List<SymbolInfoDto> results = marketService.searchSymbols("永太", 1, 20);

        // Then
        assertThat(results).isEmpty();
        verifyNoInteractions(restTemplate);
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("股票搜索 - API 异常时返回空列表")
    void searchSymbols_whenApiError_returnsEmptyList() {
        // Given
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), isNull(), any(ParameterizedTypeReference.class)))
                .thenThrow(new RestClientException("Connection error"));

        // When
        List<SymbolInfoDto> results = marketService.searchSymbols("永太", 1, 20);

        // Then
        assertThat(results).isEmpty();
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("股票详情 - 正常返回")
    void getStockDetail_shouldReturnQuote() {
        // Given
        Map<String, Object> mockData = new HashMap<>();
        mockData.put("symbol", "002326");
        mockData.put("name", "永太科技");
        mockData.put("price", 9.55);
        mockData.put("open", 9.35);
        mockData.put("high", 9.68);
        mockData.put("low", 9.30);
        mockData.put("prev_close", 9.33);
        mockData.put("volume", 125800L);
        mockData.put("amount", 1201500.0);
        mockData.put("change", 0.22);
        mockData.put("change_percent", 2.36);
        
        DataServiceResponse<Map<String, Object>> response = new DataServiceResponse<>(
                200, "success", mockData, Instant.now()
        );
        
        when(restTemplate.exchange(
                anyString(), 
                eq(HttpMethod.GET), 
                isNull(), 
                any(ParameterizedTypeReference.class)))
                .thenReturn(new ResponseEntity<>(response, HttpStatus.OK));

        // When
        PriceQuoteDto result = marketService.getStockDetail("002326");

        // Then
        assertThat(result).isNotNull();
        assertThat(result.symbol()).isEqualTo("002326");
        assertThat(result.name()).isEqualTo("永太科技");
        assertThat(result.price()).isEqualByComparingTo(new BigDecimal("9.55"));
    }

    @Test
    @DisplayName("股票详情 - 数据服务禁用时返回 null")
    void getStockDetail_whenDataServiceDisabled_returnsNull() {
        // Given
        when(properties.isEnabled()).thenReturn(false);

        // When
        PriceQuoteDto result = marketService.getStockDetail("002326");

        // Then
        assertThat(result).isNull();
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("股票详情 - API 异常时返回 null")
    void getStockDetail_whenApiError_returnsNull() {
        // Given
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), isNull(), any(ParameterizedTypeReference.class)))
                .thenThrow(new RestClientException("Connection error"));

        // When
        PriceQuoteDto result = marketService.getStockDetail("002326");

        // Then
        assertThat(result).isNull();
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("市场指数 - 正常返回")
    void getMarketIndices_shouldReturnIndices() {
        // Given
        List<Map<String, Object>> mockData = new ArrayList<>();
        Map<String, Object> item = new HashMap<>();
        item.put("symbol", "000001");
        item.put("name", "上证指数");
        item.put("price", 3250.68);
        item.put("change", 25.35);
        item.put("change_percent", 0.78);
        mockData.add(item);
        
        DataServiceResponse<List<Map<String, Object>>> response = new DataServiceResponse<>(
                200, "success", mockData, Instant.now()
        );
        
        when(restTemplate.exchange(
                anyString(), 
                eq(HttpMethod.GET), 
                isNull(), 
                any(ParameterizedTypeReference.class)))
                .thenReturn(new ResponseEntity<>(response, HttpStatus.OK));

        // When
        List<MarketIndexDto> results = marketService.getMarketIndices();

        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).symbol()).isEqualTo("000001");
        assertThat(results.get(0).name()).isEqualTo("上证指数");
        assertThat(results.get(0).price()).isEqualByComparingTo(new BigDecimal("3250.68"));
    }

    @Test
    @DisplayName("市场指数 - 数据服务禁用时返回空列表")
    void getMarketIndices_whenDataServiceDisabled_returnsEmptyList() {
        // Given
        when(properties.isEnabled()).thenReturn(false);

        // When
        List<MarketIndexDto> results = marketService.getMarketIndices();

        // Then
        assertThat(results).isEmpty();
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("市场指数 - API 异常时返回空列表")
    void getMarketIndices_whenApiError_returnsEmptyList() {
        // Given
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), isNull(), any(ParameterizedTypeReference.class)))
                .thenThrow(new RestClientException("Connection error"));

        // When
        List<MarketIndexDto> results = marketService.getMarketIndices();

        // Then
        assertThat(results).isEmpty();
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("热门股票 - 按成交量排序")
    void getHotStocks_byVolume_shouldReturnStocks() {
        // Given
        List<Map<String, Object>> mockData = new ArrayList<>();
        Map<String, Object> item = new HashMap<>();
        item.put("symbol", "002326");
        item.put("name", "永太科技");
        item.put("market", "AShare");
        item.put("volume", 125800L);
        item.put("amount", 1201500.0);
        mockData.add(item);
        
        DataServiceResponse<List<Map<String, Object>>> response = new DataServiceResponse<>(
                200, "success", mockData, Instant.now()
        );
        
        when(restTemplate.exchange(
                anyString(), 
                eq(HttpMethod.GET), 
                isNull(), 
                any(ParameterizedTypeReference.class)))
                .thenReturn(new ResponseEntity<>(response, HttpStatus.OK));

        // When
        List<SymbolInfoDto> results = marketService.getHotStocks(HotStockType.VOLUME, 20);

        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).symbol()).isEqualTo("002326");
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("热门股票 - 按涨幅排序")
    void getHotStocks_byGain_shouldReturnStocks() {
        // Given
        List<Map<String, Object>> mockData = new ArrayList<>();
        Map<String, Object> item = new HashMap<>();
        item.put("symbol", "000001");
        item.put("name", "平安银行");
        item.put("market", "AShare");
        item.put("change_percent", 5.5);
        mockData.add(item);
        
        DataServiceResponse<List<Map<String, Object>>> response = new DataServiceResponse<>(
                200, "success", mockData, Instant.now()
        );
        
        when(restTemplate.exchange(
                anyString(), 
                eq(HttpMethod.GET), 
                isNull(), 
                any(ParameterizedTypeReference.class)))
                .thenReturn(new ResponseEntity<>(response, HttpStatus.OK));

        // When
        List<SymbolInfoDto> results = marketService.getHotStocks(HotStockType.GAIN, 10);

        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).symbol()).isEqualTo("000001");
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("热门股票 - 按跌幅排序")
    void getHotStocks_byLoss_shouldReturnStocks() {
        // Given
        List<Map<String, Object>> mockData = new ArrayList<>();
        Map<String, Object> item = new HashMap<>();
        item.put("symbol", "600000");
        item.put("name", "浦发银行");
        item.put("market", "AShare");
        item.put("change_percent", -3.2);
        mockData.add(item);
        
        DataServiceResponse<List<Map<String, Object>>> response = new DataServiceResponse<>(
                200, "success", mockData, Instant.now()
        );
        
        when(restTemplate.exchange(
                anyString(), 
                eq(HttpMethod.GET), 
                isNull(), 
                any(ParameterizedTypeReference.class)))
                .thenReturn(new ResponseEntity<>(response, HttpStatus.OK));

        // When
        List<SymbolInfoDto> results = marketService.getHotStocks(HotStockType.LOSS, 15);

        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).symbol()).isEqualTo("600000");
    }

    @Test
    @DisplayName("热门股票 - 数据服务禁用时返回空列表")
    void getHotStocks_whenDataServiceDisabled_returnsEmptyList() {
        // Given
        when(properties.isEnabled()).thenReturn(false);

        // When
        List<SymbolInfoDto> results = marketService.getHotStocks(HotStockType.VOLUME, 20);

        // Then
        assertThat(results).isEmpty();
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("热门股票 - API 异常时返回空列表")
    void getHotStocks_whenApiError_returnsEmptyList() {
        // Given
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), isNull(), any(ParameterizedTypeReference.class)))
                .thenThrow(new RestClientException("Connection error"));

        // When
        List<SymbolInfoDto> results = marketService.getHotStocks(HotStockType.VOLUME, 20);

        // Then
        assertThat(results).isEmpty();
    }
}
