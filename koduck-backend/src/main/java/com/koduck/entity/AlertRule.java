package com.koduck.entity;
import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Alert rule configuration entity.
 */
@Entity
@Table(name = "alert_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRule {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;
    
    @Column(name = "rule_name", nullable = false, unique = true, length = 100)
    private String ruleName;
    
    @Column(name = "rule_type", nullable = false, length = 50)
    private String ruleType;
    
    @Column(name = "metric_name", nullable = false, length = 100)
    private String metricName;
    
    @Column(name = "threshold", nullable = false, precision = 18, scale = 4)
    private BigDecimal threshold;
    
    @Column(name = "operator", nullable = false, length = 20)
    private String operator;
    
    @Column(name = "severity", nullable = false, length = 20)
    private String severity;
    
    @Column(name = "enabled")
    private Boolean enabled;
    
    @Column(name = "cooldown_minutes")
    private Integer cooldownMinutes;
    
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
