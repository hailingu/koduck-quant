package com.koduck.knowledge.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.koduck.knowledge.dto.BasicProfileView;
import com.koduck.knowledge.dto.EntityFactView;
import com.koduck.knowledge.dto.FactsRequest;
import com.koduck.knowledge.dto.SearchHit;
import com.koduck.knowledge.service.EntityKnowledgeQueryService;
import com.koduck.knowledge.service.EntitySearchService;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/tools")
public class InternalToolExecutionController {

    private final ObjectMapper objectMapper;
    private final EntitySearchService entitySearchService;
    private final EntityKnowledgeQueryService entityKnowledgeQueryService;

    public InternalToolExecutionController(
            final ObjectMapper objectMapper,
            final EntitySearchService entitySearchService,
            final EntityKnowledgeQueryService entityKnowledgeQueryService) {
        this.objectMapper = objectMapper;
        this.entitySearchService = entitySearchService;
        this.entityKnowledgeQueryService = entityKnowledgeQueryService;
    }

    @PostMapping("/execute")
    public InternalToolExecuteResponse execute(@RequestBody final InternalToolExecuteRequest request) {
        final long startedAt = System.nanoTime();
        try {
            if (!"query_knowledge".equals(request.toolName())) {
                return rejected("UNSUPPORTED_TOOL", "unsupported tool: " + request.toolName(), startedAt);
            }

            final JsonNode args = objectMapper.readTree(request.argumentsJson());
            final String query = textField(args, "query");
            final String domainClass = textField(args, "domain_class");
            if (query == null || query.isBlank()) {
                return rejected("INVALID_ARGUMENT", "query is required", startedAt);
            }
            if (domainClass == null || domainClass.isBlank()) {
                return rejected("INVALID_ARGUMENT", "domain_class is required", startedAt);
            }

            final List<SearchHit> hits = entitySearchService.search(query, domainClass, null);
            final BasicProfileView primaryProfile = hits.isEmpty()
                    ? null
                    : entityKnowledgeQueryService.getBasicProfile(
                            hits.get(0).entityId(),
                            domainClass,
                            (OffsetDateTime) null);
            final FactsRequest factsRequest = new FactsRequest();
            factsRequest.setEntityIds(hits.stream().limit(3).map(SearchHit::entityId).toList());
            factsRequest.setDomainClass(domainClass);
            final List<EntityFactView> facts = hits.isEmpty()
                    ? List.of()
                    : entityKnowledgeQueryService.facts(factsRequest);

            final ObjectNode result = objectMapper.createObjectNode();
            result.set("hits", objectMapper.valueToTree(hits));
            result.set("primaryProfile", objectMapper.valueToTree(primaryProfile));
            result.set("facts", objectMapper.valueToTree(facts));
            final String resultJson = objectMapper.writeValueAsString(result);
            return new InternalToolExecuteResponse(true, resultJson, durationMs(startedAt), null);
        } catch (final JsonProcessingException error) {
            return rejected("INVALID_ARGUMENT", "invalid arguments_json: " + error.getOriginalMessage(), startedAt);
        } catch (final RuntimeException error) {
            return rejected("TOOL_EXECUTE_FAILED", error.getMessage(), startedAt);
        }
    }

    private InternalToolExecuteResponse rejected(
            final String code,
            final String message,
            final long startedAt) {
        return new InternalToolExecuteResponse(
                false,
                "",
                durationMs(startedAt),
                new InternalToolError(code, message));
    }

    private int durationMs(final long startedAt) {
        return (int) ((System.nanoTime() - startedAt) / 1_000_000L);
    }

    private String textField(final JsonNode node, final String fieldName) {
        final JsonNode value = node.get(fieldName);
        if (value == null || value.isNull()) {
            return null;
        }
        return value.asText();
    }

    private record InternalToolExecuteRequest(
            InternalRequestMeta meta,
            String toolName,
            String toolVersion,
            String argumentsJson,
            String executionMode) {
    }

    private record InternalRequestMeta(
            String requestId,
            String sessionId,
            String userId,
            String tenantId,
            String traceId,
            String idempotencyKey,
            long deadlineMs,
            String apiVersion) {
    }

    private record InternalToolExecuteResponse(
            boolean ok,
            String resultJson,
            int durationMs,
            InternalToolError error) {
    }

    private record InternalToolError(String code, String message) {
    }
}
