package com.koduck.knowledge.dto;

import java.util.List;

public record KnowledgeDomainCatalogView(
        String service,
        List<String> domainClasses) {
}
