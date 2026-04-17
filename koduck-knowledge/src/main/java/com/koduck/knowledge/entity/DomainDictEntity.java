package com.koduck.knowledge.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "domain_dict")
public class DomainDictEntity {

    @Id
    @Column(name = "domain_class", nullable = false)
    private String domainClass;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "description")
    private String description;

    public String getDomainClass() {
        return domainClass;
    }

    public void setDomainClass(final String domainClass) {
        this.domainClass = domainClass;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(final String displayName) {
        this.displayName = displayName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(final String description) {
        this.description = description;
    }
}
