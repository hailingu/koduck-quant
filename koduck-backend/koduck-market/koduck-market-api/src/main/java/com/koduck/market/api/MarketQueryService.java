package com.koduck.market.api;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import com.koduck.market.dto.MarketIndexDto;
import com.koduck.market.dto.PriceQuoteDto;
import com.koduck.market.dto.SectorNetworkDto;
import com.koduck.market.dto.StockIndustryDto;
import com.koduck.market.dto.StockStatsDto;
import com.koduck.market.dto.StockValuationDto;
import com.koduck.market.dto.SymbolInfoDto;

/**
 * 市场数据查询服务接口，提供股票搜索、行情报价、市场指数等查询能力。
 *
 * <p>此接口只包含只读查询操作，不包含任何写操作。</p>
 *
 * @author Koduck Team
 * @see MarketCommandService
 */
public interface MarketQueryService {

    /**
     * 根据关键词搜索股票代码和名称。
     *
     * @param keyword 匹配代码或名称的关键词
     * @param page    页码（从1开始）
     * @param size    每页大小
     * @return 匹配的股票信息列表
     * @throws IllegalArgumentException 当 page < 1 或 size < 1 时
     */
    List<SymbolInfoDto> searchSymbols(
            @NotBlank String keyword,
            @Positive int page,
            @Positive int size);

    /**
     * 返回按交易量排序的热门股票。
     *
     * @param market 市场代码（例如 "AShare"）
     * @param limit  返回的最大股票数量
     * @return 按交易量排序的热门股票列表
     * @throws IllegalArgumentException 当 limit < 1 时
     */
    List<SymbolInfoDto> getHotStocks(
            @NotBlank String market,
            @Positive int limit);

    /**
     * 获取单只股票的实时行情详情。
     *
     * @param symbol 股票代码
     * @return 股票行情详情，如未找到则返回 {@link Optional#empty()}
     */
    Optional<PriceQuoteDto> getStockDetail(@NotBlank String symbol);

    /**
     * 获取单只股票的估值指标。
     *
     * @param symbol 股票代码
     * @return 估值信息，如未找到则返回 {@link Optional#empty()}
     */
    Optional<StockValuationDto> getStockValuation(@NotBlank String symbol);

    /**
     * 获取单只股票的行业/板块元数据。
     *
     * @param symbol 股票代码
     * @return 行业信息，如未找到则返回 {@link Optional#empty()}
     */
    Optional<StockIndustryDto> getStockIndustry(@NotBlank String symbol);

    /**
     * 批量获取多只股票的行业/板块元数据。
     *
     * @param symbols 股票代码列表
     * @return 以股票代码为键的行业信息映射
     * @throws IllegalArgumentException 当 symbols 为空列表时
     */
    Map<String, StockIndustryDto> getStockIndustries(@NotNull List<String> symbols);

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
     * @throws IllegalArgumentException 当 symbols 为空列表时
     */
    List<PriceQuoteDto> getBatchPrices(@NotNull List<String> symbols);

    /**
     * 获取单只股票的交易统计信息。
     *
     * @param symbol 股票代码
     * @param market 市场代码
     * @return 股票统计信息，如未找到则返回 {@link Optional#empty()}
     */
    Optional<StockStatsDto> getStockStats(
            @NotBlank String symbol,
            @NotBlank String market);

    /**
     * 获取指定市场的板块/网络关系数据。
     *
     * @param market 市场代码
     * @return 板块网络关系数据
     */
    SectorNetworkDto getSectorNetwork(@NotBlank String market);
}
