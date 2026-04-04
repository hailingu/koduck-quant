package com.koduck.entity.strategy;

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
 * Strategy parameter entity for storing strategy configuration parameters.
 *
 * @author Koduck
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
     * Unique identifier.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * Strategy ID.
     */
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;

    /**
     * Parameter name.
     */
    @Column(name = "param_name", nullable = false, length = 50)
    private String paramName;

    /**
     * Parameter type.
     */
    @Column(name = "param_type", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private ParameterType paramType;

    /**
     * Default value.
     */
    @Column(name = "default_value", length = 100)
    private String defaultValue;

    /**
     * Minimum value.
     */
    @Column(name = "min_value", precision = 19, scale = 4)
    private BigDecimal minValue;

    /**
     * Maximum value.
     */
    @Column(name = "max_value", precision = 19, scale = 4)
    private BigDecimal maxValue;

    /**
     * Parameter description.
     */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * Flag indicating if parameter is required.
     */
    @Column(name = "is_required", nullable = false)
    @Builder.Default
    private Boolean isRequired = true;

    /**
     * Sort order.
     */
    @Column(name = "sort_order")
    private Integer sortOrder;

    /**
     * Creation timestamp.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Last update timestamp.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Parameter type enumeration.
     */
    public enum ParameterType {

        /**
         * String type parameter.
         */
        STRING,

        /**
         * Integer type parameter.
         */
        INTEGER,

        /**
         * Decimal type parameter.
         */
        DECIMAL,

        /**
         * Boolean type parameter.
         */
        BOOLEAN,

        /**
         * Enumeration type parameter.
         */
        ENUM
    }
}
