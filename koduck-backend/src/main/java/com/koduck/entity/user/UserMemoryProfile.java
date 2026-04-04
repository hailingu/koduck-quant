package com.koduck.entity.user;

import java.time.LocalDateTime;
import java.util.Map;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 用户记忆档案实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "user_memory_profile")
@Data
@NoArgsConstructor
public class UserMemoryProfile {

    /** 用户 ID。 */
    @Id
    @Column(name = "user_id")
    private Long userId;

    /** 风险偏好。 */
    @Column(name = "risk_preference", length = 64)
    private String riskPreference;

    /** 首选来源列表。 */
    @Column(name = "preferred_sources", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private java.util.List<String> preferredSources = java.util.List.of();

    /** 档案事实映射。 */
    @Column(name = "profile_facts", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> profileFacts = Map.of();

    /** 最后更新时间戳。 */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * 获取 UserMemoryProfile 的构建器。
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * UserMemoryProfile 的构建器。
     */
    public static final class Builder {

        /** 用户 ID。 */
        private Long userId;

        /** 风险偏好。 */
        private String riskPreference;

        /** 首选来源列表。 */
        private java.util.List<String> preferredSources;

        /** 档案事实映射。 */
        private Map<String, Object> profileFacts;

        /** 最后更新时间戳。 */
        private LocalDateTime updatedAt;

        /**
         * 设置用户 ID。
         *
         * @param userId 用户 ID
         * @return 构建器
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * 设置风险偏好。
         *
         * @param riskPreference 风险偏好
         * @return 构建器
         */
        public Builder riskPreference(String riskPreference) {
            this.riskPreference = riskPreference;
            return this;
        }

        /**
         * 设置首选来源。
         *
         * @param preferredSources 首选来源列表
         * @return 构建器
         */
        public Builder preferredSources(java.util.List<String> preferredSources) {
            this.preferredSources = CollectionCopyUtils.copyList(preferredSources);
            return this;
        }

        /**
         * 设置档案事实。
         *
         * @param profileFacts 档案事实映射
         * @return 构建器
         */
        public Builder profileFacts(Map<String, Object> profileFacts) {
            this.profileFacts = CollectionCopyUtils.copyMap(profileFacts);
            return this;
        }

        /**
         * 设置更新时间戳。
         *
         * @param updatedAt 更新时间戳
         * @return 构建器
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * 构建 UserMemoryProfile。
         *
         * @return UserMemoryProfile
         */
        public UserMemoryProfile build() {
            UserMemoryProfile profile = new UserMemoryProfile();
            profile.setUserId(userId);
            profile.setRiskPreference(riskPreference);
            profile.setPreferredSources(preferredSources);
            profile.setProfileFacts(profileFacts);
            profile.setUpdatedAt(updatedAt);
            return profile;
        }
    }

    /**
     * 获取首选来源的防御性副本。
     *
     * @return 首选来源列表
     */
    public java.util.List<String> getPreferredSources() {
        return CollectionCopyUtils.copyList(preferredSources);
    }

    /**
     * 使用防御性副本设置首选来源。
     *
     * @param preferredSources 首选来源列表
     */
    public void setPreferredSources(java.util.List<String> preferredSources) {
        this.preferredSources = CollectionCopyUtils.copyList(preferredSources);
    }

    /**
     * 获取档案事实的防御性副本。
     *
     * @return 档案事实映射
     */
    public Map<String, Object> getProfileFacts() {
        return CollectionCopyUtils.copyMap(profileFacts);
    }

    /**
     * 使用防御性副本设置档案事实。
     *
     * @param profileFacts 档案事实映射
     */
    public void setProfileFacts(Map<String, Object> profileFacts) {
        this.profileFacts = CollectionCopyUtils.copyMap(profileFacts);
    }
}
