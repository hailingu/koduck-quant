package com.koduck.knowledge.dto;

import java.time.OffsetDateTime;

public record SearchHit(
        long entityId,
        String canonicalName,
        String entityName,
        MatchType matchType,
        String basicProfileS3Uri,
        OffsetDateTime validFrom,
        OffsetDateTime validTo) {
}
