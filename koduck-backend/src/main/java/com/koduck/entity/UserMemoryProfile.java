package com.koduck.entity;

import com.koduck.util.CollectionCopyUtils;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
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
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserMemoryProfile {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "risk_preference", length = 64)
    private String riskPreference;

    @Column(name = "watch_symbols", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private List<String> watchSymbols = List.of();

    @Column(name = "preferred_sources", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private List<String> preferredSources = List.of();

    @Column(name = "profile_facts", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private Map<String, Object> profileFacts = Map.of();

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

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
