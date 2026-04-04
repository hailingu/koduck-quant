package com.koduck.acl;

import java.math.BigDecimal;
import java.util.Optional;

import lombok.Value;

/**
 * 回测查询服务（防腐层接口）。
 * <p>为 AI 模块提供回测结果的只读访问，隐藏底层 Repository 实现。</p>
 *
 * @author Koduck Team
 */
public interface BacktestQueryService {

    /**
     * 根据ID获取回测结果摘要。
     *
     * @param resultId 回测结果ID
     * @return 回测结果摘要
     */
    Optional<BacktestResultSummary> findResultById(Long resultId);

    /**
     * 回测结果摘要视图。
     */
    @Value
    class BacktestResultSummary {
        /** 结果ID。 */
        Long id;

        /** 股票代码。 */
        String symbol;

        /** 策略名称。 */
        String strategyName;

        /** 总收益率。 */
        BigDecimal totalReturn;

        /** 最大回撤。 */
        BigDecimal maxDrawdown;

        /** 交易次数。 */
        Integer tradeCount;
    }
}
