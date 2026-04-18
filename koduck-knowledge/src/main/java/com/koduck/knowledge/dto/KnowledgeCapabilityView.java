package com.koduck.knowledge.dto;

import java.util.List;
import java.util.Map;

public record KnowledgeCapabilityView(
        String service,
        String serviceKind,
        List<String> contractVersions,
        List<String> features,
        Map<String, String> limits) {
}
