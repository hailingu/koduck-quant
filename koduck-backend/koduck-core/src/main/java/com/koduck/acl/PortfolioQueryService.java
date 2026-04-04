package com.koduck.acl;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import lombok.Value;

/**
 * 投资组合查询服务（防腐层接口）。
 * <p>为 AI 模块提供投资组合数据的只读访问，隐藏底层 Repository 实现。</p>
 *
 * @author Koduck Team
 */
public interface PortfolioQueryService {

    /**
     * 获取用户的所有持仓（简化视图）。
     *
     * @param userId 用户ID
     * @return 持仓列表
     */
    List<PortfolioPositionSummary> findPositionsByUserId(Long userId);

    /**
     * 根据ID获取单个持仓（简化视图）。
     *
     * @param positionId 持仓ID
     * @return 持仓信息
     */
    Optional<PortfolioPositionSummary> findPositionById(Long positionId);

    /**
     * 投资组合持仓简化视图。
     */
    @Value
    class PortfolioPositionSummary {
        /** 持仓ID。 */
        Long id;

        /** 股票代码。 */
        String symbol;

        /** 市场。 */
        String market;

        /** 持仓数量。 */
        BigDecimal quantity;

        /** 平均成本价。 */
        BigDecimal averagePrice;

        /** 当前价格。 */
        BigDecimal currentPrice;
    }
}
