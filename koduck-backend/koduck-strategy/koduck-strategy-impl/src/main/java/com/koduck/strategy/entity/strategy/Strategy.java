package com.koduck.strategy.entity.strategy;

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
 * 表示交易策略的实体。
 * 存储策略元数据、状态和版本信息。
 *
 * @author Koduck Team
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
     * 策略的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 策略所有者的用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 策略名称。
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * 策略描述。
     */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * 策略当前状态。
     */
    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private StrategyStatus status = StrategyStatus.DRAFT;

    /**
     * 策略当前版本号。
     */
    @Column(name = "current_version", nullable = false)
    @Builder.Default
    private Integer currentVersion = 1;

    /**
     * 策略创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 策略最后更新时间戳。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 表示策略可能状态的枚举。
     */
    public enum StrategyStatus {
        /** 草稿状态 - 策略正在编辑中。 */
        DRAFT,
        /** 已发布状态 - 策略活跃且可见。 */
        PUBLISHED,
        /** 已禁用状态 - 策略非活跃。 */
        DISABLED
    }
}
