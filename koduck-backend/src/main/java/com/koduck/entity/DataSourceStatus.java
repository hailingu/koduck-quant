package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Data source status entity.
 */
@Entity
@Table(name = "data_source_status")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataSourceStatus {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "source_name", nullable = false, unique = true, length = 100)
    private String sourceName;
    
    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType;
    
    @Column(name = "status", length = 20)
    private String status;
    
    @Column(name = "last_success_at")
    private LocalDateTime lastSuccessAt;
    
    @Column(name = "last_failure_at")
    private LocalDateTime lastFailureAt;
    
    @Column(name = "failure_count")
    private Integer failureCount;
    
    @Column(name = "consecutive_failures")
    private Integer consecutiveFailures;
    
    @Column(name = "response_time_ms")
    private Integer responseTimeMs;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
