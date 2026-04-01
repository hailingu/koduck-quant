package com.koduck.entity;

import com.koduck.util.CollectionCopyUtils;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "user_memory_profile")
@Data
@NoArgsConstructor
public class UserMemoryProfile {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "risk_preference", length = 64)
    private String riskPreference;

    @Column(name = "watch_symbols", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> watchSymbols = List.of();

    @Column(name = "preferred_sources", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> preferredSources = List.of();

    @Column(name = "profile_facts", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> profileFacts = Map.of();

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long userId;
        private String riskPreference;
        private List<String> watchSymbols;
        private List<String> preferredSources;
        private Map<String, Object> profileFacts;
        private LocalDateTime updatedAt;

        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder riskPreference(String riskPreference) { this.riskPreference = riskPreference; return this; }
        public Builder watchSymbols(List<String> watchSymbols) { this.watchSymbols = CollectionCopyUtils.copyList(watchSymbols); return this; }
        public Builder preferredSources(List<String> preferredSources) { this.preferredSources = CollectionCopyUtils.copyList(preferredSources); return this; }
        public Builder profileFacts(Map<String, Object> profileFacts) { this.profileFacts = CollectionCopyUtils.copyMap(profileFacts); return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

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

    public List<String> getWatchSymbols() {
        return CollectionCopyUtils.copyList(watchSymbols);
    }

    public void setWatchSymbols(List<String> watchSymbols) {
        this.watchSymbols = CollectionCopyUtils.copyList(watchSymbols);
    }

    public List<String> getPreferredSources() {
        return CollectionCopyUtils.copyList(preferredSources);
    }

    public void setPreferredSources(List<String> preferredSources) {
        this.preferredSources = CollectionCopyUtils.copyList(preferredSources);
    }

    public Map<String, Object> getProfileFacts() {
        return CollectionCopyUtils.copyMap(profileFacts);
    }

    public void setProfileFacts(Map<String, Object> profileFacts) {
        this.profileFacts = CollectionCopyUtils.copyMap(profileFacts);
    }
}
