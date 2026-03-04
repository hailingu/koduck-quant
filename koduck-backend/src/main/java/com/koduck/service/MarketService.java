package com.koduck.service;

import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SymbolInfoDto;

import java.util.List;

/**
 * 市场数据服务接口。
 * 提供股票搜索、详情、指数等功能。
 */
public interface MarketService {
    
    /**
     * 搜索股票。
     *
     * @param keyword 搜索关键词
     * @param page    页码
     * @param size    每页数量
     * @return 匹配的股票列表
     */
    List<SymbolInfoDto> searchSymbols(String keyword, int page, int size);
    
    /**
     * 获取股票详情（实时行情）。
     *
     * @param symbol 股票代码
     * @return 实时行情数据
     */
    PriceQuoteDto getStockDetail(String symbol);
    
    /**
     * 获取市场指数列表。
     * 包含上证指数、深证成指、创业板指等主要指数。
     *
     * @return 指数列表
     */
    List<MarketIndexDto> getMarketIndices();
    
    /**
     * 批量获取股票实时行情。
     *
     * @param symbols 股票代码列表
     * @return 实时行情列表
     */
    List<PriceQuoteDto> getBatchPrices(List<String> symbols);
}
