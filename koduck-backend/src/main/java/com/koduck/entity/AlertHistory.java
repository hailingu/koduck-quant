package com.koduck.entity;

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
 * Alert history entity.
 *
 * @author Koduck
 */
@Entity
@Table(name = "alert_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertHistory {

    /**
     * Unique identifier.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * Alert rule ID.
     */
    @Column(name = "alert_rule_id", nullable = false)
    private Long alertRuleId;

    /**
     * Rule name.
     */
    @Column(name = "rule_name", nullable = false, length = 100)
    private String ruleName;

    /**
     * Severity level.
     */
    @Column(name = "severity", nullable = false, length = 20)
    private String severity;

    /**
     * Metric name.
     */
    @Column(name = "metric_name", nullable = false, length = 100)
    private String metricName;

    /**
     * Metric value.
     */
    @Column(name = "metric_value", precision = 18, scale = 4)
    private BigDecimal metricValue;

    /**
     * Threshold value.
     */
    @Column(name = "threshold", precision = 18, scale = 4)
    private BigDecimal threshold;

    /**
     * Alert message.
     */
    @Column(name = "message", nullable = false, columnDefinition = "TEXT")
    private String message;

    /**
     * Alert status.
     */
    @Column(name = "status", length = 20)
    private String status;

    /**
     * Notification flag.
     */
    @Column(name = "notified")
    private Boolean notified;

    /**
     * Resolution timestamp.
     */
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    /**
     * Creation timestamp.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
