package com.koduck.knowledge.dto;

import java.time.OffsetDateTime;

public record BasicProfileSegment(
        long entityId,
        String domainClass,
        String entityName,
        OffsetDateTime validFrom,
        OffsetDateTime validTo,
        String basicProfileS3Uri) {
}
