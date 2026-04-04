package com.koduck.acl;

import java.util.List;
import java.util.Optional;

import lombok.Value;

/**
 * 策略查询服务（防腐层接口）。
 * <p>为 AI 模块提供策略数据的只读访问，隐藏底层 Repository 实现。</p>
 *
 * @author Koduck Team
 */
public interface StrategyQueryService {

    /**
     * 根据ID获取策略摘要信息。
     *
     * @param strategyId 策略ID
     * @return 策略摘要
     */
    Optional<StrategySummary> findStrategyById(Long strategyId);

    /**
     * 获取用户的所有策略摘要信息。
     *
     * @param userId 用户ID
     * @return 策略摘要列表
     */
    List<StrategySummary> findStrategiesByUserId(Long userId);

    /**
     * 策略摘要视图。
     */
    @Value
    class StrategySummary {
        /** 策略ID。 */
        Long id;

        /** 策略名称。 */
        String name;

        /** 策略类型。 */
        String type;

        /** 策略描述。 */
        String description;
    }
}
