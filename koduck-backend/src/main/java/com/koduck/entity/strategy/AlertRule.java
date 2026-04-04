package com.koduck.entity.strategy;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
 * 告警规则配置实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "alert_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRule {

    /** 告警规则的唯一标识符。 */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** 告警规则名称，必须唯一。 */
    @Column(name = "rule_name", nullable = false, unique = true, length = 100)
    private String ruleName;

    /** 告警规则类型（例如：PRICE、VOLUME）。 */
    @Column(name = "rule_type", nullable = false, length = 50)
    private String ruleType;

    /** 被监控的指标名称。 */
    @Column(name = "metric_name", nullable = false, length = 100)
    private String metricName;

    /** 触发告警的阈值。 */
    @Column(name = "threshold", nullable = false, precision = 18, scale = 4)
    private BigDecimal threshold;

    /** 比较运算符（例如：GREATER_THAN、LESS_THAN）。 */
    @Column(name = "operator", nullable = false, length = 20)
    private String operator;

    /** 告警严重级别（例如：LOW、MEDIUM、HIGH）。 */
    @Column(name = "severity", nullable = false, length = 20)
    private String severity;

    /** 规则是否当前启用。 */
    @Column(name = "enabled")
    private Boolean enabled;

    /** 告警之间的冷却期（分钟）。 */
    @Column(name = "cooldown_minutes")
    private Integer cooldownMinutes;

    /** 告警规则描述。 */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /** 规则创建时间戳。 */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** 最后更新时间戳。 */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
