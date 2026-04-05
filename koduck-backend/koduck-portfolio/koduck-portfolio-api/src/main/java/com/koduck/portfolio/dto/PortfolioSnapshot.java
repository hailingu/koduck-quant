package com.koduck.portfolio.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 投资组合快照值对象。
 *
 * <p>供 AI 模块等外部模块通过 ACL 访问投资组合数据。</p>
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param portfolioId         投资组合ID
 * @param portfolioName       投资组合名称
 * @param positions           持仓快照列表
 * @param totalValue          总市值
 * @param totalCost           总成本
 * @param totalReturn         总收益
 * @param totalReturnPercent  总收益率
 * @author Koduck Team
 * @see com.koduck.portfolio.api.acl.PortfolioQueryService
 */
public record PortfolioSnapshot(
        Long portfolioId,
        String portfolioName,
        List<PositionSnapshot> positions,
        BigDecimal totalValue,
        BigDecimal totalCost,
        BigDecimal totalReturn,
        BigDecimal totalReturnPercent
) {

    /**
     * 持仓快照。
     *
     * @param positionId   持仓ID
     * @param symbol       股票代码
     * @param market       市场代码
     * @param quantity     持仓数量
     * @param avgCost      平均成本
     * @param currentPrice 当前价格
     * @param marketValue  市值
     */
    public record PositionSnapshot(
            Long positionId,
            String symbol,
            String market,
            BigDecimal quantity,
            BigDecimal avgCost,
            BigDecimal currentPrice,
            BigDecimal marketValue
    ) {
    }
}
