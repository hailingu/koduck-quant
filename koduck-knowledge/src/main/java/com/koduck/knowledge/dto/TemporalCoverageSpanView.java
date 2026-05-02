package com.koduck.knowledge.dto;

import java.time.OffsetDateTime;

public record TemporalCoverageSpanView(
        long spanId,
        OffsetDateTime spanFrom,
        OffsetDateTime spanTo,
        String summary,
        String granularity) {
}
