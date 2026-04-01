package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Setter;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Alert history entity.
 */
@Entity
@Table(name = "alert_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertHistory {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;
    
    @Column(name = "alert_rule_id", nullable = false)
    private Long alertRuleId;
    
    @Column(name = "rule_name", nullable = false, length = 100)
    private String ruleName;
    
    @Column(name = "severity", nullable = false, length = 20)
    private String severity;
    
    @Column(name = "metric_name", nullable = false, length = 100)
    private String metricName;
    
    @Column(name = "metric_value", precision = 18, scale = 4)
    private BigDecimal metricValue;
    
    @Column(name = "threshold", precision = 18, scale = 4)
    private BigDecimal threshold;
    
    @Column(name = "message", nullable = false, columnDefinition = "TEXT")
    private String message;
    
    @Column(name = "status", length = 20)
    private String status;
    
    @Column(name = "notified")
    private Boolean notified;
    
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
