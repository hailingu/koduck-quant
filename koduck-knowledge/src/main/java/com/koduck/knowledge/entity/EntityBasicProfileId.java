package com.koduck.knowledge.entity;

import java.io.Serial;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;

public class EntityBasicProfileId implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long entityId;
    private String domainClass;
    private OffsetDateTime validFrom;

    public EntityBasicProfileId() {
    }

    public EntityBasicProfileId(final Long entityId, final String domainClass, final OffsetDateTime validFrom) {
        this.entityId = entityId;
        this.domainClass = domainClass;
        this.validFrom = validFrom;
    }

    @Override
    public boolean equals(final Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof EntityBasicProfileId that)) {
            return false;
        }
        return Objects.equals(entityId, that.entityId)
                && Objects.equals(domainClass, that.domainClass)
                && Objects.equals(validFrom, that.validFrom);
    }

    @Override
    public int hashCode() {
        return Objects.hash(entityId, domainClass, validFrom);
    }
}
