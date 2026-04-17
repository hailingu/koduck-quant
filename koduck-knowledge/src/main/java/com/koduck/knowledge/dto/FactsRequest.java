package com.koduck.knowledge.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;

public class FactsRequest {

    @NotEmpty
    private List<Long> entityIds;

    @NotBlank
    private String domainClass;

    private OffsetDateTime at;

    private List<String> profileEntryCodes;

    public List<Long> getEntityIds() {
        return entityIds;
    }

    public void setEntityIds(final List<Long> entityIds) {
        this.entityIds = entityIds;
    }

    public String getDomainClass() {
        return domainClass;
    }

    public void setDomainClass(final String domainClass) {
        this.domainClass = domainClass;
    }

    public OffsetDateTime getAt() {
        return at;
    }

    public void setAt(final OffsetDateTime at) {
        this.at = at;
    }

    public List<String> getProfileEntryCodes() {
        return profileEntryCodes;
    }

    public void setProfileEntryCodes(final List<String> profileEntryCodes) {
        this.profileEntryCodes = profileEntryCodes;
    }
}
