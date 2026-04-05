package com.koduck.strategy.vo;

import java.io.Serializable;
import java.time.Instant;

/**
 * 策略快照值对象。
 *
 * <p>供其他领域模块（如 AI）使用，包含策略的核心信息。</p>
 *
 * @param strategyId 策略ID
 * @param userId 用户ID
 * @param name 策略名称
 * @param description 策略描述
 * @param type 策略类型
 * @param params 策略参数（JSON格式）
 * @param status 策略状态
 * @param createdAt 创建时间
 * @param backtestCount 回测次数
 */
public record StrategySnapshot(
        Long strategyId,
        Long userId,
        String name,
        String description,
        String type,
        String params,
        String status,
        Instant createdAt,
        Integer backtestCount
) implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 策略状态常量。
     */
    public static class Status {
        public static final String ACTIVE = "ACTIVE";
        public static final String INACTIVE = "INACTIVE";
        public static final String DELETED = "DELETED";
    }

    /**
     * 策略类型常量。
     */
    public static class Type {
        public static final String MA_CROSSOVER = "MA_CROSSOVER";
        public static final String RSI = "RSI";
        public static final String MACD = "MACD";
        public static final String CUSTOM = "CUSTOM";
    }
}
