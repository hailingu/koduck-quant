package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 
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
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;
    
    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;
    
    @Column(name = "code", columnDefinition = "TEXT")
    private String code;
    
    @Column(name = "changelog", columnDefinition = "TEXT")
    private String changelog;
    
    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
