package com.koduck.knowledge.dto;

import java.time.OffsetDateTime;

public record ProfileDetailView(
        long entityId,
        String entryCode,
        int version,
        boolean isCurrent,
        String blobUri,
        OffsetDateTime loadedAt) {
}
