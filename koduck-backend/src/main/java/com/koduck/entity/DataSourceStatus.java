package com.koduck.entity;

import com.koduck.util.CollectionCopyUtils;
import jakarta.persistence.*;
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
@NoArgsConstructor
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

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long id;
        private String sourceName;
        private String sourceType;
        private String status;
        private LocalDateTime lastSuccessAt;
        private LocalDateTime lastFailureAt;
        private Integer failureCount;
        private Integer consecutiveFailures;
        private Integer responseTimeMs;
        private Map<String, Object> metadata;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder sourceName(String sourceName) { this.sourceName = sourceName; return this; }
        public Builder sourceType(String sourceType) { this.sourceType = sourceType; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder lastSuccessAt(LocalDateTime lastSuccessAt) { this.lastSuccessAt = lastSuccessAt; return this; }
        public Builder lastFailureAt(LocalDateTime lastFailureAt) { this.lastFailureAt = lastFailureAt; return this; }
        public Builder failureCount(Integer failureCount) { this.failureCount = failureCount; return this; }
        public Builder consecutiveFailures(Integer consecutiveFailures) { this.consecutiveFailures = consecutiveFailures; return this; }
        public Builder responseTimeMs(Integer responseTimeMs) { this.responseTimeMs = responseTimeMs; return this; }
        public Builder metadata(Map<String, Object> metadata) { this.metadata = CollectionCopyUtils.copyMap(metadata); return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

        public DataSourceStatus build() {
            DataSourceStatus statusEntity = new DataSourceStatus();
            statusEntity.setId(id);
            statusEntity.setSourceName(sourceName);
            statusEntity.setSourceType(sourceType);
            statusEntity.setStatus(status);
            statusEntity.setLastSuccessAt(lastSuccessAt);
            statusEntity.setLastFailureAt(lastFailureAt);
            statusEntity.setFailureCount(failureCount);
            statusEntity.setConsecutiveFailures(consecutiveFailures);
            statusEntity.setResponseTimeMs(responseTimeMs);
            statusEntity.setMetadata(metadata);
            statusEntity.setCreatedAt(createdAt);
            statusEntity.setUpdatedAt(updatedAt);
            return statusEntity;
        }
    }

    public Map<String, Object> getMetadata() {
        return CollectionCopyUtils.copyMap(metadata);
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = CollectionCopyUtils.copyMap(metadata);
    }
}
