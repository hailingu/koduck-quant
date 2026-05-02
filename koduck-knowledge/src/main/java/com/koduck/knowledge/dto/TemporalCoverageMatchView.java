package com.koduck.knowledge.dto;

import java.util.List;

public record TemporalCoverageMatchView(
        long entityId,
        long profileId,
        String entryCode,
        String blobUri,
        List<TemporalCoverageSpanView> matchedSpans) {
}
