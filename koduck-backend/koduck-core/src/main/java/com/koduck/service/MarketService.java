package com.koduck.service;

import java.util.List;
import java.util.Map;

import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SectorNetworkDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;

/**
 * 市场数据服务接口，提供股票搜索、行情报价、市场指数、板块行业及相关操作。
 *
 * @author GitHub Copilot
 */
public interface MarketService {

    /**
     * 根据关键词搜索股票代码和名称。
     *
     * @param keyword 匹配代码或名称的关键词
     * @param page    页码（从1开始）
     * @param size    每页大小
     * @return 匹配的股票信息列表
     */
    List<SymbolInfoDto> searchSymbols(String keyword, int page, int size);

    /**
     * 返回按交易量排序的热门股票。
     *
     * @param market 市场代码（例如 "AShare"）
     * @param limit  返回的最大股票数量
     * @return 按交易量排序的热门股票列表
     */
    List<SymbolInfoDto> getHotStocks(String market, int limit);

    /**
     * 获取单只股票的实时行情详情。
     *
     * @param symbol 股票代码
     * @return 股票行情详情，如未找到则返回 {@code null}
     */
    PriceQuoteDto getStockDetail(String symbol);

    /**
     * 获取单只股票的估值指标。
     *
     * @param symbol 股票代码
     * @return 估值信息，如未找到则返回 {@code null}
     */
    StockValuationDto getStockValuation(String symbol);

    /**
     * 获取单只股票的行业/板块元数据。
     *
     * @param symbol 股票代码
     * @return 行业信息，如未找到则返回 {@code null}
     */
    StockIndustryDto getStockIndustry(String symbol);

    /**
     * 批量获取多只股票的行业/板块元数据。
     *
     * @param symbols 股票代码列表
     * @return 以股票代码为键的行业信息映射
     */
    Map<String, StockIndustryDto> getStockIndustries(List<String> symbols);

    /**
     * 获取主要市场指数列表。
     *
     * @return 市场指数行情列表
     */
    List<MarketIndexDto> getMarketIndices();

    /**
     * 批量获取多只股票的实时行情。
     *
     * @param symbols 股票代码列表
     * @return 与输入代码匹配的行情列表
     */
    List<PriceQuoteDto> getBatchPrices(List<String> symbols);

    /**
     * 获取单只股票的交易统计信息。
     *
     * @param symbol 股票代码
     * @param market 市场代码
     * @return 股票统计信息，如未找到则返回 {@code null}
     */
    StockStatsDto getStockStats(String symbol, String market);

    /**
     * 获取指定市场的板块/网络关系数据。
     *
     * @param market 市场代码
     * @return 板块网络关系数据
     */
    SectorNetworkDto getSectorNetwork(String market);
}
