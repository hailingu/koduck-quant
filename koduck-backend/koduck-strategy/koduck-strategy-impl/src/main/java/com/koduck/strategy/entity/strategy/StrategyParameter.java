package com.koduck.strategy.entity.strategy;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 策略参数实体，用于存储策略配置参数。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "strategy_parameters",
       indexes = {
           @Index(name = "idx_param_strategy", columnList = "strategy_id")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrategyParameter {

    /**
     * 唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 策略 ID。
     */
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;

    /**
     * 参数名称。
     */
    @Column(name = "param_name", nullable = false, length = 50)
    private String paramName;

    /**
     * 参数类型。
     */
    @Column(name = "param_type", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ParameterType paramType;

    /**
     * 默认值。
     */
    @Column(name = "default_value", length = 100)
    private String defaultValue;

    /**
     * 最小值。
     */
    @Column(name = "min_value", precision = 19, scale = 4)
    private BigDecimal minValue;

    /**
     * 最大值。
     */
    @Column(name = "max_value", precision = 19, scale = 4)
    private BigDecimal maxValue;

    /**
     * 参数描述。
     */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * 指示参数是否必需的标志。
     */
    @Column(name = "is_required", nullable = false)
    @Builder.Default
    private Boolean isRequired = true;

    /**
     * 排序顺序。
     */
    @Column(name = "sort_order")
    private Integer sortOrder;

    /**
     * 创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 最后更新时间戳。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 参数类型枚举。
     */
    public enum ParameterType {

        /**
         * 字符串类型参数。
         */
        STRING,

        /**
         * 整数类型参数。
         */
        INTEGER,

        /**
         * 小数类型参数。
         */
        DECIMAL,

        /**
         * 布尔类型参数。
         */
        BOOLEAN,

        /**
         * 枚举类型参数。
         */
        ENUM
    }
}
