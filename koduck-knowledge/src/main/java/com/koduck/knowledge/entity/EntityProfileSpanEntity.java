package com.koduck.knowledge.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "entity_profile_span")
public class EntityProfileSpanEntity {

    @Id
    @Column(name = "span_id", nullable = false)
    private Long spanId;

    @Column(name = "profile_id", nullable = false)
    private Long profileId;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Column(name = "entry_code", nullable = false)
    private String entryCode;

    @Column(name = "blob_uri", nullable = false)
    private String blobUri;

    @Column(name = "span_from")
    private OffsetDateTime spanFrom;

    @Column(name = "span_to")
    private OffsetDateTime spanTo;

    @Column(name = "summary")
    private String summary;

    @Column(name = "granularity", nullable = false)
    private String granularity;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    public Long getSpanId() {
        return spanId;
    }

    public void setSpanId(final Long spanId) {
        this.spanId = spanId;
    }

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

    public String getEntryCode() {
        return entryCode;
    }

    public void setEntryCode(final String entryCode) {
        this.entryCode = entryCode;
    }

    public String getBlobUri() {
        return blobUri;
    }

    public void setBlobUri(final String blobUri) {
        this.blobUri = blobUri;
    }

    public OffsetDateTime getSpanFrom() {
        return spanFrom;
    }

    public void setSpanFrom(final OffsetDateTime spanFrom) {
        this.spanFrom = spanFrom;
    }

    public OffsetDateTime getSpanTo() {
        return spanTo;
    }

    public void setSpanTo(final OffsetDateTime spanTo) {
        this.spanTo = spanTo;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(final String summary) {
        this.summary = summary;
    }

    public String getGranularity() {
        return granularity;
    }

    public void setGranularity(final String granularity) {
        this.granularity = granularity;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(final Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
