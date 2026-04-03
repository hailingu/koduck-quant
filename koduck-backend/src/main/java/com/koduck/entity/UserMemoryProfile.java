package com.koduck.entity;

import java.time.LocalDateTime;
import java.util.List;
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
 * Entity for user memory profile.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "user_memory_profile")
@Data
@NoArgsConstructor
public class UserMemoryProfile {

    /** The user ID. */
    @Id
    @Column(name = "user_id")
    private Long userId;

    /** The risk preference. */
    @Column(name = "risk_preference", length = 64)
    private String riskPreference;

    /** The watch symbols list. */
    @Column(name = "watch_symbols", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> watchSymbols = List.of();

    /** The preferred sources list. */
    @Column(name = "preferred_sources", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> preferredSources = List.of();

    /** The profile facts map. */
    @Column(name = "profile_facts", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> profileFacts = Map.of();

    /** The last update timestamp. */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * Get a builder for UserMemoryProfile.
     *
     * @return the builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for UserMemoryProfile.
     */
    public static final class Builder {

        /** The user ID. */
        private Long userId;

        /** The risk preference. */
        private String riskPreference;

        /** The watch symbols list. */
        private List<String> watchSymbols;

        /** The preferred sources list. */
        private List<String> preferredSources;

        /** The profile facts map. */
        private Map<String, Object> profileFacts;

        /** The last update timestamp. */
        private LocalDateTime updatedAt;

        /**
         * Set the user ID.
         *
         * @param userId the user ID
         * @return the builder
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * Set the risk preference.
         *
         * @param riskPreference the risk preference
         * @return the builder
         */
        public Builder riskPreference(String riskPreference) {
            this.riskPreference = riskPreference;
            return this;
        }

        /**
         * Set the watch symbols.
         *
         * @param watchSymbols the watch symbols list
         * @return the builder
         */
        public Builder watchSymbols(List<String> watchSymbols) {
            this.watchSymbols = CollectionCopyUtils.copyList(watchSymbols);
            return this;
        }

        /**
         * Set the preferred sources.
         *
         * @param preferredSources the preferred sources list
         * @return the builder
         */
        public Builder preferredSources(List<String> preferredSources) {
            this.preferredSources = CollectionCopyUtils.copyList(preferredSources);
            return this;
        }

        /**
         * Set the profile facts.
         *
         * @param profileFacts the profile facts map
         * @return the builder
         */
        public Builder profileFacts(Map<String, Object> profileFacts) {
            this.profileFacts = CollectionCopyUtils.copyMap(profileFacts);
            return this;
        }

        /**
         * Set the updated at timestamp.
         *
         * @param updatedAt the updated at timestamp
         * @return the builder
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * Build the UserMemoryProfile.
         *
         * @return the UserMemoryProfile
         */
        public UserMemoryProfile build() {
            UserMemoryProfile profile = new UserMemoryProfile();
            profile.setUserId(userId);
            profile.setRiskPreference(riskPreference);
            profile.setWatchSymbols(watchSymbols);
            profile.setPreferredSources(preferredSources);
            profile.setProfileFacts(profileFacts);
            profile.setUpdatedAt(updatedAt);
            return profile;
        }
    }

    /**
     * Get the watch symbols with defensive copy.
     *
     * @return the watch symbols list
     */
    public List<String> getWatchSymbols() {
        return CollectionCopyUtils.copyList(watchSymbols);
    }

    /**
     * Set the watch symbols with defensive copy.
     *
     * @param watchSymbols the watch symbols list
     */
    public void setWatchSymbols(List<String> watchSymbols) {
        this.watchSymbols = CollectionCopyUtils.copyList(watchSymbols);
    }

    /**
     * Get the preferred sources with defensive copy.
     *
     * @return the preferred sources list
     */
    public List<String> getPreferredSources() {
        return CollectionCopyUtils.copyList(preferredSources);
    }

    /**
     * Set the preferred sources with defensive copy.
     *
     * @param preferredSources the preferred sources list
     */
    public void setPreferredSources(List<String> preferredSources) {
        this.preferredSources = CollectionCopyUtils.copyList(preferredSources);
    }

    /**
     * Get the profile facts with defensive copy.
     *
     * @return the profile facts map
     */
    public Map<String, Object> getProfileFacts() {
        return CollectionCopyUtils.copyMap(profileFacts);
    }

    /**
     * Set the profile facts with defensive copy.
     *
     * @param profileFacts the profile facts map
     */
    public void setProfileFacts(Map<String, Object> profileFacts) {
        this.profileFacts = CollectionCopyUtils.copyMap(profileFacts);
    }
}
