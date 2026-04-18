package com.koduck.knowledge.dto;

public record KnowledgeToolDefinitionView(
        String name,
        String version,
        String description,
        String inputSchema,
        String outputSchema,
        int timeoutMs,
        String permissionScope,
        boolean streamingSupported) {
}
