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
import org.hibernate.annotations.UpdateTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Alert rule configuration entity.
 *
 * @author koduck
 */
@Entity
@Table(name = "alert_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRule {

    /** Unique identifier for the alert rule. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** Name of the alert rule, must be unique. */
    @Column(name = "rule_name", nullable = false, unique = true, length = 100)
    private String ruleName;

    /** Type of the alert rule (e.g., PRICE, VOLUME). */
    @Column(name = "rule_type", nullable = false, length = 50)
    private String ruleType;

    /** Name of the metric being monitored. */
    @Column(name = "metric_name", nullable = false, length = 100)
    private String metricName;

    /** Threshold value for triggering the alert. */
    @Column(name = "threshold", nullable = false, precision = 18, scale = 4)
    private BigDecimal threshold;

    /** Comparison operator (e.g., GREATER_THAN, LESS_THAN). */
    @Column(name = "operator", nullable = false, length = 20)
    private String operator;

    /** Severity level of the alert (e.g., LOW, MEDIUM, HIGH). */
    @Column(name = "severity", nullable = false, length = 20)
    private String severity;

    /** Whether the rule is currently active. */
    @Column(name = "enabled")
    private Boolean enabled;

    /** Cooldown period in minutes between alerts. */
    @Column(name = "cooldown_minutes")
    private Integer cooldownMinutes;

    /** Description of the alert rule. */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /** Timestamp when the rule was created. */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** Timestamp of last update. */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
