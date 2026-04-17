package com.koduck.knowledge.dto;

import java.time.OffsetDateTime;

public record EntityFactView(
        long entityId,
        String domainClass,
        String entityName,
        String basicProfileS3Uri,
        OffsetDateTime validFrom,
        OffsetDateTime validTo,
        String profileEntryCode,
        String blobUri) {
}
