package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * 交易策略实体
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
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "name", nullable = false, length = 100)
    private String name;
    
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private StrategyStatus status = StrategyStatus.DRAFT;
    
    @Column(name = "current_version", nullable = false)
    @Builder.Default
    private Integer currentVersion = 1;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    public enum StrategyStatus {
        DRAFT,      // 草稿
        PUBLISHED,  // 已发布
        DISABLED    // 已停用
    }
}
