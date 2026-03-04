package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.MarketService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 市场数据 REST API 控制器。
 * 提供股票搜索、详情、指数等接口。
 */
@RestController
@RequestMapping("/api/v1/market")
@RequiredArgsConstructor
@Tag(name = "市场数据", description = "市场配置、股票代码搜索、市场指数等市场相关接口")
@Validated
@Slf4j
public class MarketController {
    
    private final MarketService marketService;
    
    /**
     * 股票搜索接口。
     * 根据关键词搜索股票代码或名称。
     *
     * @param keyword 搜索关键词
     * @param page    页码（从 1 开始，默认 1）
     * @param size    每页数量（默认 20，最大 100）
     * @return 匹配的股票列表
     */
    @GetMapping("/search")
    public ApiResponse<List<SymbolInfoDto>> searchSymbols(
            @RequestParam @NotBlank(message = "关键词不能为空") 
            @Size(max = 50, message = "关键词长度不能超过 50") 
            String keyword,
            @RequestParam(defaultValue = "1") 
            @Min(value = 1, message = "页码最小为 1") 
            Integer page,
            @RequestParam(defaultValue = "20") 
            @Min(value = 1, message = "每页数量最小为 1") 
            @Max(value = 100, message = "每页数量最大为 100") 
            Integer size) {
        
        log.info("GET /api/v1/market/search: keyword={}, page={}, size={}", keyword, page, size);
        
        List<SymbolInfoDto> results = marketService.searchSymbols(keyword, page, size);
        return ApiResponse.success(results);
    }
    
    /**
     * 股票详情接口。
     * 获取单只股票的实时行情数据。
     *
     * @param symbol 股票代码（如 002326）
     * @return 股票实时行情
     */
    @GetMapping("/stocks/{symbol}")
    public ApiResponse<PriceQuoteDto> getStockDetail(
            @PathVariable @NotBlank(message = "股票代码不能为空") 
            String symbol) {
        
        log.info("GET /api/v1/market/stocks/{}", symbol);
        
        PriceQuoteDto quote = marketService.getStockDetail(symbol);
        if (quote == null) {
            return ApiResponse.error(404, "股票代码不存在: " + symbol);
        }
        return ApiResponse.success(quote);
    }
    
    /**
     * 市场指数接口。
     * 获取主要市场指数（上证指数、深证成指、创业板指等）。
     *
     * @return 指数列表
     */
    @GetMapping("/indices")
    public ApiResponse<List<MarketIndexDto>> getMarketIndices() {
        log.info("GET /api/v1/market/indices");
        
        List<MarketIndexDto> indices = marketService.getMarketIndices();
        return ApiResponse.success(indices);
    }
    
    /**
     * 批量股票行情接口。
     * 批量获取多只股票的实时行情数据。
     *
     * @param symbols 股票代码列表（逗号分隔，最多 50 个）
     * @return 股票实时行情列表
     */
    @GetMapping("/batch")
    public ApiResponse<List<PriceQuoteDto>> getBatchPrices(
            @RequestParam @NotEmpty(message = "股票代码列表不能为空")
            List<String> symbols) {
        
        log.info("GET /api/v1/market/batch: count={}", symbols.size());
        
        List<PriceQuoteDto> quotes = marketService.getBatchPrices(symbols);
        return ApiResponse.success(quotes);
    }
}
