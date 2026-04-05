package com.koduck.strategy.dto;

import lombok.Builder;
import lombok.Value;

import java.io.Serializable;
import java.time.Instant;

/**
 * 策略摘要信息。
 *
 * <p>用于列表展示，不包含完整的策略代码。</p>
 *
 * @param id 策略ID
 * @param name 策略名称
 * @param type 策略类型
 * @param status 策略状态
 * @param backtestCount 回测次数
 * @param createdAt 创建时间
 */
@Value
@Builder
public class StrategySummaryDto implements Serializable {
    private static final long serialVersionUID = 1L;

    Long id;
    String name;
    String type;
    String status;
    Integer backtestCount;
    Instant createdAt;
}
