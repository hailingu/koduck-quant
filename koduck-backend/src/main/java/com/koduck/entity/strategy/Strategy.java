package com.koduck.entity.strategy;

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
 * Entity representing a trading strategy.
 * Stores strategy metadata, status, and versioning information.
 *
 * @author GitHub Copilot
 */
@Entity
@Table(name = "strategies",
       indexes = {
           @Index(name = "idx_strategy_user", columnList = "user_id"),
           @Index(name = "idx_strategy_status", columnList = "status"),
           @Index(name = "idx_strategy_user_status", columnList = "user_id, status")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Strategy {

    /**
     * Unique identifier for the strategy.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * ID of the user who owns this strategy.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Name of the strategy.
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * Description of the strategy.
     */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * Current status of the strategy.
     */
    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private StrategyStatus status = StrategyStatus.DRAFT;

    /**
     * Current version number of the strategy.
     */
    @Column(name = "current_version", nullable = false)
    @Builder.Default
    private Integer currentVersion = 1;

    /**
     * Timestamp when the strategy was created.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Timestamp when the strategy was last updated.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Enum representing the possible statuses of a strategy.
     */
    public enum StrategyStatus {
        /** Draft status - strategy is being edited. */
        DRAFT,
        /** Published status - strategy is active and visible. */
        PUBLISHED,
        /** Disabled status - strategy is inactive. */
        DISABLED
    }
}
