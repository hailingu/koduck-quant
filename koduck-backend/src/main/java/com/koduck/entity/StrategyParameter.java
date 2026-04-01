package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 
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
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;
    
    @Column(name = "param_name", nullable = false, length = 50)
    private String paramName;
    
    @Column(name = "param_type", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ParameterType paramType;
    
    @Column(name = "default_value", length = 100)
    private String defaultValue;
    
    @Column(name = "min_value", precision = 19, scale = 4)
    private BigDecimal minValue;
    
    @Column(name = "max_value", precision = 19, scale = 4)
    private BigDecimal maxValue;
    
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "is_required", nullable = false)
    @Builder.Default
    private Boolean isRequired = true;
    
    @Column(name = "sort_order")
    private Integer sortOrder;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    public enum ParameterType {
        STRING,     // 
        INTEGER,    // 
        DECIMAL,    // 
        BOOLEAN,    // 
        ENUM        // 
    }
}
