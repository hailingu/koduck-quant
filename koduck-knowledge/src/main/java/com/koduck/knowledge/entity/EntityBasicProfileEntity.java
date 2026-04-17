package com.koduck.knowledge.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "entity_basic_profile")
@IdClass(EntityBasicProfileId.class)
public class EntityBasicProfileEntity {

    @Id
    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Id
    @Column(name = "domain_class", nullable = false)
    private String domainClass;

    @Id
    @Column(name = "valid_from", nullable = false)
    private OffsetDateTime validFrom;

    @Column(name = "entity_name", nullable = false)
    private String entityName;

    @Column(name = "valid_to")
    private OffsetDateTime validTo;

    @Column(name = "basic_profile_entry_id", nullable = false)
    private Integer basicProfileEntryId;

    @Column(name = "basic_profile_s3_uri", nullable = false)
    private String basicProfileS3Uri;

    public Long getEntityId() {
        return entityId;
    }

    public void setEntityId(final Long entityId) {
        this.entityId = entityId;
    }

    public String getDomainClass() {
        return domainClass;
    }

    public void setDomainClass(final String domainClass) {
        this.domainClass = domainClass;
    }

    public OffsetDateTime getValidFrom() {
        return validFrom;
    }

    public void setValidFrom(final OffsetDateTime validFrom) {
        this.validFrom = validFrom;
    }

    public String getEntityName() {
        return entityName;
    }

    public void setEntityName(final String entityName) {
        this.entityName = entityName;
    }

    public OffsetDateTime getValidTo() {
        return validTo;
    }

    public void setValidTo(final OffsetDateTime validTo) {
        this.validTo = validTo;
    }

    public Integer getBasicProfileEntryId() {
        return basicProfileEntryId;
    }

    public void setBasicProfileEntryId(final Integer basicProfileEntryId) {
        this.basicProfileEntryId = basicProfileEntryId;
    }

    public String getBasicProfileS3Uri() {
        return basicProfileS3Uri;
    }

    public void setBasicProfileS3Uri(final String basicProfileS3Uri) {
        this.basicProfileS3Uri = basicProfileS3Uri;
    }
}
