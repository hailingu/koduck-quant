package com.koduck.knowledge.dto;

import java.time.OffsetDateTime;

public record BasicProfileView(
        long entityId,
        String canonicalName,
        String entityName,
        String domainClass,
        OffsetDateTime validFrom,
        OffsetDateTime validTo,
        String basicProfileS3Uri) {
}
