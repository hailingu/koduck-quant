package com.koduck.portfolio.event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * 持仓变更领域事件。
 *
 * @param eventId      事件唯一标识
 * @param timestamp    事件发生时间
 * @param userId       用户ID
 * @param positionId   持仓ID
 * @param symbol       股票代码
 * @param changeType   变更类型（ADD/UPDATE/DELETE）
 * @param oldQuantity  原数量
 * @param newQuantity  新数量
 * @param oldAvgCost   原平均成本
 * @param newAvgCost   新平均成本
 * @author Koduck Team
 */
public record PositionChangedEvent(
        String eventId,
        Instant timestamp,
        Long userId,
        Long positionId,
        String symbol,
        String changeType,
        BigDecimal oldQuantity,
        BigDecimal newQuantity,
        BigDecimal oldAvgCost,
        BigDecimal newAvgCost
) {

    /**
     * 变更类型枚举。
     */
    /** 添加类型。 */
    public static final String TYPE_ADD = "ADD";
    /** 更新类型。 */
    public static final String TYPE_UPDATE = "UPDATE";
    /** 删除类型。 */
    public static final String TYPE_DELETE = "DELETE";

    /**
     * 创建新的事件实例，自动生成事件ID和时间戳。
     */
    public PositionChangedEvent(
            Long userId,
            Long positionId,
            String symbol,
            String changeType,
            BigDecimal oldQuantity,
            BigDecimal newQuantity,
            BigDecimal oldAvgCost,
            BigDecimal newAvgCost) {
        this(
                UUID.randomUUID().toString(),
                Instant.now(),
                userId,
                positionId,
                symbol,
                changeType,
                oldQuantity,
                newQuantity,
                oldAvgCost,
                newAvgCost
        );
    }
}
