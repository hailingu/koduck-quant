package com.koduck.portfolio.api;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 投资组合命令服务接口。
 *
 * <p>提供投资组合、持仓的创建、更新、删除等写操作。</p>
 *
 * @author Koduck Team
 * @see PortfolioQueryService
 */
public interface PortfolioCommandService {

    /**
     * 添加持仓。
     *
     * @param userId   用户ID
     * @param market   市场代码
     * @param symbol   股票代码
     * @param quantity 持仓数量
     * @param avgCost  平均成本
     * @return 新创建的持仓ID
     */
    Long addPosition(
            @NotNull @Positive Long userId,
            @NotBlank String market,
            @NotBlank String symbol,
            @NotNull @Positive BigDecimal quantity,
            @NotNull @Positive BigDecimal avgCost);

    /**
     * 更新持仓数量。
     *
     * @param positionId 持仓ID
     * @param quantity   新数量
     * @param avgCost    新平均成本
     * @return 是否更新成功
     */
    boolean updatePosition(
            @NotNull @Positive Long positionId,
            @NotNull @Positive BigDecimal quantity,
            @NotNull @Positive BigDecimal avgCost);

    /**
     * 删除持仓。
     *
     * @param positionId 持仓ID
     * @return 是否删除成功
     */
    boolean deletePosition(@NotNull @Positive Long positionId);

    /**
     * 记录交易。
     *
     * @param userId    用户ID
     * @param market    市场代码
     * @param symbol    股票代码
     * @param tradeType 交易类型（BUY/SELL）
     * @param quantity  交易数量
     * @param price     交易价格
     * @param notes     交易备注
     * @return 新创建的交易记录ID
     */
    Long recordTrade(
            @NotNull @Positive Long userId,
            @NotBlank String market,
            @NotBlank String symbol,
            @NotBlank String tradeType,
            @NotNull @Positive BigDecimal quantity,
            @NotNull @Positive BigDecimal price,
            String notes);
}
