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

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 告警历史实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "alert_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertHistory {

    /**
     * 唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 告警规则 ID。
     */
    @Column(name = "alert_rule_id", nullable = false)
    private Long alertRuleId;

    /**
     * 规则名称。
     */
    @Column(name = "rule_name", nullable = false, length = 100)
    private String ruleName;

    /**
     * 严重级别。
     */
    @Column(name = "severity", nullable = false, length = 20)
    private String severity;

    /**
     * 指标名称。
     */
    @Column(name = "metric_name", nullable = false, length = 100)
    private String metricName;

    /**
     * 指标值。
     */
    @Column(name = "metric_value", precision = 18, scale = 4)
    private BigDecimal metricValue;

    /**
     * 阈值。
     */
    @Column(name = "threshold", precision = 18, scale = 4)
    private BigDecimal threshold;

    /**
     * 告警消息。
     */
    @Column(name = "message", nullable = false, columnDefinition = "TEXT")
    private String message;

    /**
     * 告警状态。
     */
    @Column(name = "status", length = 20)
    private String status;

    /**
     * 通知标志。
     */
    @Column(name = "notified")
    private Boolean notified;

    /**
     * 解决时间戳。
     */
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    /**
     * 创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
