package com.koduck.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entity representing a version of a trading strategy.
 * Stores version-specific code, changelog, and activation status.
 *
 * @author GitHub Copilot
 */
@Entity
@Table(name = "strategy_versions",
       indexes = {
           @Index(name = "idx_version_strategy", columnList = "strategy_id"),
           @Index(name = "idx_version_number", columnList = "strategy_id, version_number")
       }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrategyVersion {

    /**
     * Unique identifier for the strategy version.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * ID of the parent strategy.
     */
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;

    /**
     * Version number within the strategy.
     */
    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    /**
     * Strategy code content.
     */
    @Column(name = "code", columnDefinition = "TEXT")
    private String code;

    /**
     * Changelog describing changes in this version.
     */
    @Column(name = "changelog", columnDefinition = "TEXT")
    private String changelog;

    /**
     * Flag indicating if this version is currently active.
     */
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    /**
     * Timestamp when this version was created.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
