package com.koduck.knowledge.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "entity_alias")
public class EntityAliasEntity {

    @Id
    @Column(name = "alias_id", nullable = false)
    private Long aliasId;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Column(name = "alias", nullable = false)
    private String alias;

    @Column(name = "lang", nullable = false)
    private String lang;

    @Column(name = "source", nullable = false)
    private String source;

    public Long getAliasId() {
        return aliasId;
    }

    public void setAliasId(final Long aliasId) {
        this.aliasId = aliasId;
    }

    public Long getEntityId() {
        return entityId;
    }

    public void setEntityId(final Long entityId) {
        this.entityId = entityId;
    }

    public String getAlias() {
        return alias;
    }

    public void setAlias(final String alias) {
        this.alias = alias;
    }

    public String getLang() {
        return lang;
    }

    public void setLang(final String lang) {
        this.lang = lang;
    }

    public String getSource() {
        return source;
    }

    public void setSource(final String source) {
        this.source = source;
    }
}
