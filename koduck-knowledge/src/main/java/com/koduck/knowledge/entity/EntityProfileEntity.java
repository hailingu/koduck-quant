package com.koduck.knowledge.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "entity_profile")
public class EntityProfileEntity {

    @Id
    @Column(name = "profile_id", nullable = false)
    private Long profileId;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Column(name = "profile_entry_id", nullable = false)
    private Integer profileEntryId;

    @Column(name = "blob_uri", nullable = false)
    private String blobUri;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "is_current", nullable = false)
    private boolean current;

    @Column(name = "loaded_at", nullable = false)
    private OffsetDateTime loadedAt;

    public Long getProfileId() {
        return profileId;
    }

    public void setProfileId(final Long profileId) {
        this.profileId = profileId;
    }

    public Long getEntityId() {
        return entityId;
    }

    public void setEntityId(final Long entityId) {
        this.entityId = entityId;
    }

    public Integer getProfileEntryId() {
        return profileEntryId;
    }

    public void setProfileEntryId(final Integer profileEntryId) {
        this.profileEntryId = profileEntryId;
    }

    public String getBlobUri() {
        return blobUri;
    }

    public void setBlobUri(final String blobUri) {
        this.blobUri = blobUri;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(final Integer version) {
        this.version = version;
    }

    public boolean isCurrent() {
        return current;
    }

    public void setCurrent(final boolean current) {
        this.current = current;
    }

    public OffsetDateTime getLoadedAt() {
        return loadedAt;
    }

    public void setLoadedAt(final OffsetDateTime loadedAt) {
        this.loadedAt = loadedAt;
    }
}
