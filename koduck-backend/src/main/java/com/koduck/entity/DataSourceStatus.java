package com.koduck.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.Map;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import com.koduck.util.CollectionCopyUtils;

/**
 * Data source status entity.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "data_source_status")
@Data
@NoArgsConstructor
public class DataSourceStatus {

    /**
     * Primary key.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * Source name.
     */
    @Column(name = "source_name", nullable = false, unique = true, length = 100)
    private String sourceName;

    /**
     * Source type.
     */
    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType;

    /**
     * Status.
     */
    @Column(name = "status", length = 20)
    private String status;

    /**
     * Last success time.
     */
    @Column(name = "last_success_at")
    private LocalDateTime lastSuccessAt;

    /**
     * Last failure time.
     */
    @Column(name = "last_failure_at")
    private LocalDateTime lastFailureAt;

    /**
     * Failure count.
     */
    @Column(name = "failure_count")
    private Integer failureCount;

    /**
     * Consecutive failures.
     */
    @Column(name = "consecutive_failures")
    private Integer consecutiveFailures;

    /**
     * Response time in milliseconds.
     */
    @Column(name = "response_time_ms")
    private Integer responseTimeMs;

    /**
     * Metadata.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    /**
     * Created at.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Updated at.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Creates a new builder.
     *
     * @return Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for DataSourceStatus.
     */
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

        /**
         * Sets the ID.
         *
         * @param id the ID
         * @return this builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the source name.
         *
         * @param sourceName the source name
         * @return this builder
         */
        public Builder sourceName(String sourceName) {
            this.sourceName = sourceName;
            return this;
        }

        /**
         * Sets the source type.
         *
         * @param sourceType the source type
         * @return this builder
         */
        public Builder sourceType(String sourceType) {
            this.sourceType = sourceType;
            return this;
        }

        /**
         * Sets the status.
         *
         * @param status the status
         * @return this builder
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
         * Sets the last success at.
         *
         * @param lastSuccessAt the last success at
         * @return this builder
         */
        public Builder lastSuccessAt(LocalDateTime lastSuccessAt) {
            this.lastSuccessAt = lastSuccessAt;
            return this;
        }

        /**
         * Sets the last failure at.
         *
         * @param lastFailureAt the last failure at
         * @return this builder
         */
        public Builder lastFailureAt(LocalDateTime lastFailureAt) {
            this.lastFailureAt = lastFailureAt;
            return this;
        }

        /**
         * Sets the failure count.
         *
         * @param failureCount the failure count
         * @return this builder
         */
        public Builder failureCount(Integer failureCount) {
            this.failureCount = failureCount;
            return this;
        }

        /**
         * Sets the consecutive failures.
         *
         * @param consecutiveFailures the consecutive failures
         * @return this builder
         */
        public Builder consecutiveFailures(Integer consecutiveFailures) {
            this.consecutiveFailures = consecutiveFailures;
            return this;
        }

        /**
         * Sets the response time.
         *
         * @param responseTimeMs the response time in milliseconds
         * @return this builder
         */
        public Builder responseTimeMs(Integer responseTimeMs) {
            this.responseTimeMs = responseTimeMs;
            return this;
        }

        /**
         * Sets the metadata.
         *
         * @param metadata the metadata
         * @return this builder
         */
        public Builder metadata(Map<String, Object> metadata) {
            this.metadata = CollectionCopyUtils.copyMap(metadata);
            return this;
        }

        /**
         * Sets the created at.
         *
         * @param createdAt the created at
         * @return this builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Sets the updated at.
         *
         * @param updatedAt the updated at
         * @return this builder
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * Builds the DataSourceStatus.
         *
         * @return the DataSourceStatus
         */
        public DataSourceStatus build() {
            DataSourceStatus statusEntity = new DataSourceStatus();
            statusEntity.id = id;
            statusEntity.setSourceName(sourceName);
            statusEntity.setSourceType(sourceType);
            statusEntity.setStatus(status);
            statusEntity.setLastSuccessAt(lastSuccessAt);
            statusEntity.setLastFailureAt(lastFailureAt);
            statusEntity.setFailureCount(failureCount);
            statusEntity.setConsecutiveFailures(consecutiveFailures);
            statusEntity.setResponseTimeMs(responseTimeMs);
            statusEntity.setMetadata(metadata);
            statusEntity.createdAt = createdAt;
            statusEntity.setUpdatedAt(updatedAt);
            return statusEntity;
        }
    }

    /**
     * Gets metadata copy.
     *
     * @return metadata copy
     */
    public Map<String, Object> getMetadata() {
        return CollectionCopyUtils.copyMap(metadata);
    }

    /**
     * Sets metadata with copy.
     *
     * @param metadata the metadata
     */
    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = CollectionCopyUtils.copyMap(metadata);
    }
}
