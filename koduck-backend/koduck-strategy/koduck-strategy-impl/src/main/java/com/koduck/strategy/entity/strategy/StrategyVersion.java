package com.koduck.strategy.entity.strategy;

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
 * 表示交易策略版本的实体。
 * 存储版本特定的代码、变更日志和激活状态。
 *
 * @author Koduck Team
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
     * 策略版本的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 父策略的 ID。
     */
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;

    /**
     * 策略内的版本号。
     */
    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    /**
     * 策略代码内容。
     */
    @Column(name = "code", columnDefinition = "TEXT")
    private String code;

    /**
     * 描述此版本变更的变更日志。
     */
    @Column(name = "changelog", columnDefinition = "TEXT")
    private String changelog;

    /**
     * 指示此版本是否当前激活的标志。
     */
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    /**
     * 此版本创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
