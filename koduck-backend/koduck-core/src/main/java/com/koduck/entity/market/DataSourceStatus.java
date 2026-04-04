package com.koduck.entity.market;

import java.time.LocalDateTime;
import java.util.Map;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import com.koduck.util.CollectionCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 数据源状态实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "data_source_status")
@Data
@NoArgsConstructor
public class DataSourceStatus {

    /**
     * 主键。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 数据源名称。
     */
    @Column(name = "source_name", nullable = false, unique = true, length = 100)
    private String sourceName;

    /**
     * 数据源类型。
     */
    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType;

    /**
     * 状态。
     */
    @Column(name = "status", length = 20)
    private String status;

    /**
     * 最后成功时间。
     */
    @Column(name = "last_success_at")
    private LocalDateTime lastSuccessAt;

    /**
     * 最后失败时间。
     */
    @Column(name = "last_failure_at")
    private LocalDateTime lastFailureAt;

    /**
     * 失败次数。
     */
    @Column(name = "failure_count")
    private Integer failureCount;

    /**
     * 连续失败次数。
     */
    @Column(name = "consecutive_failures")
    private Integer consecutiveFailures;

    /**
     * 响应时间（毫秒）。
     */
    @Column(name = "response_time_ms")
    private Integer responseTimeMs;

    /**
     * 元数据。
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    /**
     * 创建时间。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 更新时间。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 创建新的构建器。
     *
     * @return 构建器实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * DataSourceStatus 的构建器类。
     */
    public static final class Builder {

        /**
         * 构建器 id 字段。
         */
        private Long id;

        /**
         * 构建器 sourceName 字段。
         */
        private String sourceName;

        /**
         * 构建器 sourceType 字段。
         */
        private String sourceType;

        /**
         * 构建器 status 字段。
         */
        private String status;

        /**
         * 构建器 lastSuccessAt 字段。
         */
        private LocalDateTime lastSuccessAt;

        /**
         * 构建器 lastFailureAt 字段。
         */
        private LocalDateTime lastFailureAt;

        /**
         * 构建器 failureCount 字段。
         */
        private Integer failureCount;

        /**
         * 构建器 consecutiveFailures 字段。
         */
        private Integer consecutiveFailures;

        /**
         * 构建器 responseTimeMs 字段。
         */
        private Integer responseTimeMs;

        /**
         * 构建器 metadata 字段。
         */
        private Map<String, Object> metadata;

        /**
         * 构建器 createdAt 字段。
         */
        private LocalDateTime createdAt;

        /**
         * 构建器 updatedAt 字段。
         */
        private LocalDateTime updatedAt;

        /**
         * 设置 ID。
         *
         * @param id ID
         * @return 此构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置数据源名称。
         *
         * @param sourceName 数据源名称
         * @return 此构建器
         */
        public Builder sourceName(String sourceName) {
            this.sourceName = sourceName;
            return this;
        }

        /**
         * 设置数据源类型。
         *
         * @param sourceType 数据源类型
         * @return 此构建器
         */
        public Builder sourceType(String sourceType) {
            this.sourceType = sourceType;
            return this;
        }

        /**
         * 设置状态。
         *
         * @param status 状态
         * @return 此构建器
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
         * 设置最后成功时间。
         *
         * @param lastSuccessAt 最后成功时间
         * @return 此构建器
         */
        public Builder lastSuccessAt(LocalDateTime lastSuccessAt) {
            this.lastSuccessAt = lastSuccessAt;
            return this;
        }

        /**
         * 设置最后失败时间。
         *
         * @param lastFailureAt 最后失败时间
         * @return 此构建器
         */
        public Builder lastFailureAt(LocalDateTime lastFailureAt) {
            this.lastFailureAt = lastFailureAt;
            return this;
        }

        /**
         * 设置失败次数。
         *
         * @param failureCount 失败次数
         * @return 此构建器
         */
        public Builder failureCount(Integer failureCount) {
            this.failureCount = failureCount;
            return this;
        }

        /**
         * 设置连续失败次数。
         *
         * @param consecutiveFailures 连续失败次数
         * @return 此构建器
         */
        public Builder consecutiveFailures(Integer consecutiveFailures) {
            this.consecutiveFailures = consecutiveFailures;
            return this;
        }

        /**
         * 设置响应时间。
         *
         * @param responseTimeMs 响应时间（毫秒）
         * @return 此构建器
         */
        public Builder responseTimeMs(Integer responseTimeMs) {
            this.responseTimeMs = responseTimeMs;
            return this;
        }

        /**
         * 设置元数据。
         *
         * @param metadata 元数据
         * @return 此构建器
         */
        public Builder metadata(Map<String, Object> metadata) {
            this.metadata = CollectionCopyUtils.copyMap(metadata);
            return this;
        }

        /**
         * 设置创建时间。
         *
         * @param createdAt 创建时间
         * @return 此构建器
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * 设置更新时间。
         *
         * @param updatedAt 更新时间
         * @return 此构建器
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * 构建 DataSourceStatus。
         *
         * @return DataSourceStatus
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
     * 获取元数据副本。
     *
     * @return 元数据副本
     */
    public Map<String, Object> getMetadata() {
        return CollectionCopyUtils.copyMap(metadata);
    }

    /**
     * 使用副本设置元数据。
     *
     * @param metadata 元数据
     */
    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = CollectionCopyUtils.copyMap(metadata);
    }
}
