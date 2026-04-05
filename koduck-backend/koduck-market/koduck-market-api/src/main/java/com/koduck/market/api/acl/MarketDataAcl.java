package com.koduck.market.api.acl;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import com.koduck.market.dto.PriceQuoteDto;

/**
 * 行情数据防腐层接口。
 *
 * <p>供其他领域模块（如 Portfolio、AI）查询行情数据使用。</p>
 *
 * <p>此接口提供简化的、只读的行情数据访问，隔离领域模型差异。</p>
 *
 * @author Koduck Team
 * @see com.koduck.market.api.MarketQueryService
 */
public interface MarketDataAcl {

    /**
     * 批量获取最新价格。
     *
     * <p>用于投资组合计算持仓市值。</p>
     *
     * @param symbols 股票代码列表
     * @return 代码到价格的映射，未找到的价格为 null
     * @throws IllegalArgumentException 当 symbols 为空列表时
     */
    Map<String, BigDecimal> getLatestPrices(@NotEmpty List<String> symbols);

    /**
     * 获取单只股票的最新价格。
     *
     * @param symbol 股票代码
     * @return 最新价格，未找到时返回 null
     */
    BigDecimal getLatestPrice(@NotNull String symbol);

    /**
     * 批量获取行情数据。
     *
     * <p>用于需要完整行情数据的场景。</p>
     *
     * @param symbols 股票代码列表
     * @return 行情数据列表
     * @throws IllegalArgumentException 当 symbols 为空列表时
     */
    List<PriceQuoteDto> getQuotes(@NotEmpty List<String> symbols);

    /**
     * 获取单只股票行情。
     *
     * @param symbol 股票代码
     * @return 行情数据，未找到时返回 null
     */
    PriceQuoteDto getQuote(@NotNull String symbol);
}
