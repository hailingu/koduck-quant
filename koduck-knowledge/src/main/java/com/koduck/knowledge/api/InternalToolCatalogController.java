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
                                "用于检索 koduck-knowledge 的结构化实体知识。这个工具只做候选实体搜索和主命中 basic profile 读取，不会直接展开非 BASIC 详情。若请求上下文里已有明确 domain_class，应显式传入；如果 domain_class 缺失但 query 已能指向实体，可先返回跨 domain 的候选实体供用户选择；如果连实体 query 都不明确，就不应调用。",
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
                                "用于在 query_knowledge 确认候选实体后，按 entity_id + entry_code 读取该实体非 BASIC profile 的单条详情元信息。对支持时态窗口的 profile，可额外传入 at 读取该时点命中的详情。只有当 basic profile 不足以回答问题，且需要单个时点详情时，才继续调用这个工具。",
                                buildProfileDetailInputSchema(profileEntryCodes),
                                """
                                {"type":"object","properties":{"entityId":{"type":"integer","description":"实体 ID。"},"entryCode":{"type":"string","description":"请求的非 BASIC profile entry code。"},"version":{"type":"integer","description":"命中的详情版本号。"},"isCurrent":{"type":"boolean","description":"命中版本是否当前版本。"},"blobUri":{"type":"string","description":"详情内容所在的 blob URI。"},"loadedAt":{"type":"string","description":"详情装载时间。"},"validFrom":{"type":"string","description":"该详情版本的生效起点（若有时态窗口）。"},"validTo":{"type":"string","description":"该详情版本的生效终点（若有时态窗口）。"}}}
                                """,
                                5000,
                                "knowledge.read",
                                false),
                        new KnowledgeToolDefinitionView(
                                "get_knowledge_profile_history",
                                "v1",
                                "用于在 query_knowledge 确认候选实体后，按 entity_id + entry_code 读取该实体非 BASIC profile 的版本时间线。若用户要求“某年以后”“某段期间”“某时间范围内”的资料，应优先使用 from / to 过滤命中的版本窗口。填写 from / to 时应保持用户原始时间粒度，例如“到 2012 年”为止传 to=2012，“到 2012-07”为止传 to=2012-07，“到 2012-07-20”为止传 to=2012-07-20，不要自己预展开到下一天或下一年。注意这个工具一次只查询单个 entry_code；若问题本质上是在问某段时间内有哪些经历、事件或资料，通常需要对多个相关 temporal entry code 分别查询后再合并结果，而不是只查一个 entry_code 就下结论。",
                                buildProfileHistoryInputSchema(profileEntryCodes),
                                """
                                {"type":"object","properties":{"items":{"type":"array","description":"按版本倒序返回的 profile 版本列表。"},"page":{"type":"integer","description":"当前页码。"},"size":{"type":"integer","description":"当前分页大小。"},"total":{"type":"integer","description":"符合过滤条件的总记录数。"}}}
                                """,
                                5000,
                                "knowledge.read",
                                false),
                        new KnowledgeToolDefinitionView(
                                "get_knowledge_temporal_coverage",
                                "v1",
                                "用于在 query_knowledge 确认候选实体后，按 entity_id + 时间范围直接检索该实体的时间覆盖索引。它会跨多个 entry_code 返回与用户时间窗口有重叠的 blob 候选，并把命中的 span 一起带回。若用户在问“某年以后”“某几年之间”“该时期有没有资料”，应优先使用这个工具，而不是先猜单个 entry_code。填写 from / to 时应保持用户原始时间粒度，例如“到 2012 年”为止传 to=2012，“到 2012-07”为止传 to=2012-07，“到 2012-07-20”为止传 to=2012-07-20，不要自己预展开到下一天或下一年。",
                                buildTemporalCoverageInputSchema(),
                                """
                                {"type":"object","properties":{"items":{"type":"array","description":"按 blob 分组的时间覆盖命中结果，每项附带 matchedSpans。"},"page":{"type":"integer","description":"当前页码。"},"size":{"type":"integer","description":"当前分页大小。"},"total":{"type":"integer","description":"符合过滤条件的 blob 分组总数。"}}}
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

        final ObjectNode at = properties.putObject("at");
        at.put("type", "string");
        at.put("description", "可选；ISO-8601 时间点。若该 profile 支持时态窗口，则按该时点命中详情版本。");

        root.putArray("required").add("entity_id");
        root.withArray("required").add("entry_code");
        root.put("additionalProperties", false);
        return writeJson(root);
    }

    private String buildProfileHistoryInputSchema(final List<String> profileEntryCodes) {
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

        final ObjectNode from = properties.putObject("from");
        from.put("type", "string");
        from.put("description", "可选；时间范围起点。支持 YYYY、YYYY-MM、YYYY-MM-DD 或完整 ISO-8601；应保持用户原始粒度。返回与 [from, to) 有重叠的版本。");

        final ObjectNode to = properties.putObject("to");
        to.put("type", "string");
        to.put("description", "可选；时间范围终点。支持 YYYY、YYYY-MM、YYYY-MM-DD 或完整 ISO-8601；应保持用户原始粒度，不要预展开到下一天或下一年。返回与 [from, to) 有重叠的版本。");

        final ObjectNode page = properties.putObject("page");
        page.put("type", "integer");
        page.put("description", "可选；页码，默认 1。");

        final ObjectNode size = properties.putObject("size");
        size.put("type", "integer");
        size.put("description", "可选；分页大小，默认 20。");

        root.putArray("required").add("entity_id");
        root.withArray("required").add("entry_code");
        root.put("additionalProperties", false);
        return writeJson(root);
    }

    private String buildTemporalCoverageInputSchema() {
        final ObjectNode root = objectMapper.createObjectNode();
        root.put("type", "object");

        final ObjectNode properties = root.putObject("properties");
        final ObjectNode entityId = properties.putObject("entity_id");
        entityId.put("type", "integer");
        entityId.put("description", "query_knowledge 返回的候选实体 ID。");

        final ObjectNode from = properties.putObject("from");
        from.put("type", "string");
        from.put("description", "可选；时间范围起点。支持 YYYY、YYYY-MM、YYYY-MM-DD 或完整 ISO-8601；应保持用户原始粒度。至少需要提供 from / to 之一。");

        final ObjectNode to = properties.putObject("to");
        to.put("type", "string");
        to.put("description", "可选；时间范围终点。支持 YYYY、YYYY-MM、YYYY-MM-DD 或完整 ISO-8601；应保持用户原始粒度，不要预展开到下一天或下一年。至少需要提供 from / to 之一。");

        final ObjectNode page = properties.putObject("page");
        page.put("type", "integer");
        page.put("description", "可选；页码，默认 1。");

        final ObjectNode size = properties.putObject("size");
        size.put("type", "integer");
        size.put("description", "可选；分页大小，默认 20。");

        root.putArray("required").add("entity_id");
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
