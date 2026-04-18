package com.koduck.knowledge.dto;

import java.util.List;

public record KnowledgeToolCatalogView(String service, List<KnowledgeToolDefinitionView> tools) {
}
