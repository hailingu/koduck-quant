package com.koduck.knowledge.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.koduck.knowledge.dto.KnowledgeToolCatalogView;
import com.koduck.knowledge.dto.KnowledgeToolDefinitionView;
import com.koduck.knowledge.service.DomainCatalogService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
public class InternalToolCatalogController {

    private final DomainCatalogService domainCatalogService;
    private final ObjectMapper objectMapper;

    public InternalToolCatalogController(final DomainCatalogService domainCatalogService) {
        this.domainCatalogService = domainCatalogService;
        this.objectMapper = new ObjectMapper();
    }

    @GetMapping("/tools")
    public KnowledgeToolCatalogView getTools() {
        final List<String> domainClasses = domainCatalogService.listDomainClasses();
        final List<String> profileEntryCodes = domainCatalogService.listNonBasicProfileEntryCodes();
        return new KnowledgeToolCatalogView(
                "koduck-knowledge",
                List.of(
                        new KnowledgeToolDefinitionView(
                                "query_knowledge",
                                "v1",
                                "用于检索 koduck-knowledge 的结构化实体知识。这个工具只做候选实体搜索和主命中 basic profile 读取，不会直接展开非 BASIC 详情。若请求上下文里已有明确 domain_class，应显式传入；如果没有，就不要臆造 domain_class。",
                                buildQueryInputSchema(domainClasses),
                                """
                                {"type":"object","properties":{"hits":{"type":"array","description":"知识库返回的候选实体列表。"},"primaryProfile":{"type":"object","description":"首个候选实体的基础档案。"}}}
                                """,
                                5000,
                                "knowledge.read",
                                false),
                        new KnowledgeToolDefinitionView(
                                "get_knowledge_profile_detail",
                                "v1",
                                "用于在 query_knowledge 确认候选实体后，按 entity_id + entry_code 读取该实体当前非 BASIC profile 的详情元信息。只有当 basic profile 不足以回答问题时，才继续调用这个工具。",
                                buildProfileDetailInputSchema(profileEntryCodes),
                                """
                                {"type":"object","properties":{"entityId":{"type":"integer","description":"实体 ID。"},"entryCode":{"type":"string","description":"请求的非 BASIC profile entry code。"},"version":{"type":"integer","description":"当前详情版本号。"},"isCurrent":{"type":"boolean","description":"是否当前版本。"},"blobUri":{"type":"string","description":"详情内容所在的 blob URI。"},"loadedAt":{"type":"string","description":"详情装载时间。"}}}
                                """,
                                5000,
                                "knowledge.read",
                                false)));
    }

    private String buildQueryInputSchema(final List<String> domainClasses) {
        final ObjectNode root = objectMapper.createObjectNode();
        root.put("type", "object");

        final ObjectNode properties = root.putObject("properties");
        final ObjectNode query = properties.putObject("query");
        query.put("type", "string");
        query.put("description", "要检索的实体名称、公司名、人物名或主题关键词。");

        final ObjectNode domainClass = properties.putObject("domain_class");
        domainClass.put("type", "string");
        domainClass.put("description", buildDomainClassDescription(domainClasses));
        if (!domainClasses.isEmpty()) {
            final ArrayNode enumValues = domainClass.putArray("enum");
            domainClasses.forEach(enumValues::add);
        }

        root.putArray("required").add("query");
        root.put("additionalProperties", false);
        return writeJson(root);
    }

    private String buildProfileDetailInputSchema(final List<String> profileEntryCodes) {
        final ObjectNode root = objectMapper.createObjectNode();
        root.put("type", "object");

        final ObjectNode properties = root.putObject("properties");
        final ObjectNode entityId = properties.putObject("entity_id");
        entityId.put("type", "integer");
        entityId.put("description", "query_knowledge 返回的候选实体 ID。");

        final ObjectNode entryCode = properties.putObject("entry_code");
        entryCode.put("type", "string");
        entryCode.put("description", buildProfileEntryDescription(profileEntryCodes));
        if (!profileEntryCodes.isEmpty()) {
            final ArrayNode enumValues = entryCode.putArray("enum");
            profileEntryCodes.forEach(enumValues::add);
        }

        root.putArray("required").add("entity_id");
        root.withArray("required").add("entry_code");
        root.put("additionalProperties", false);
        return writeJson(root);
    }

    private String buildDomainClassDescription(final List<String> domainClasses) {
        if (domainClasses.isEmpty()) {
            return "可选但强烈建议提供；合法值动态来自 koduck-knowledge 的 domain_dict。当前未注册任何 domain_class。若请求 metadata 已明确给出 domain_class，可省略。";
        }
        return "可选但强烈建议提供；合法值动态来自 koduck-knowledge 的 domain_dict："
                + String.join(", ", domainClasses)
                + "。若请求 metadata 已明确给出 domain_class，可省略。";
    }

    private String buildProfileEntryDescription(final List<String> profileEntryCodes) {
        if (profileEntryCodes.isEmpty()) {
            return "必填；合法值动态来自 profile_entry_dict。当前未注册任何非 BASIC entry code。";
        }
        return "必填；合法值动态来自 profile_entry_dict："
                + String.join(", ", profileEntryCodes)
                + "。";
    }

    private String writeJson(final ObjectNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("failed to serialize knowledge tool schema", error);
        }
    }
}
