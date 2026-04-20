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
        return new KnowledgeToolCatalogView(
                "koduck-knowledge",
                List.of(new KnowledgeToolDefinitionView(
                        "query_knowledge",
                        "v1",
                        "用于检索 koduck-knowledge 的结构化实体知识。只有当你需要做实体对齐、候选实体搜索，或者读取基础档案与只读 facts 时，才调用这个工具。若请求上下文里已有明确 domain_class，应显式传入；如果没有，就不要臆造 domain_class。",
                        buildInputSchema(),
                        """
                        {"type":"object","properties":{"hits":{"type":"array","description":"知识库返回的候选实体列表。"},"primaryProfile":{"type":"object","description":"首个候选实体的基础档案。"},"facts":{"type":"array","description":"围绕候选实体展开的只读 facts。"}}}
                        """,
                        5000,
                        "knowledge.read",
                        false)));
    }

    private String buildInputSchema() {
        final List<String> domainClasses = domainCatalogService.listDomainClasses();
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

    private String buildDomainClassDescription(final List<String> domainClasses) {
        if (domainClasses.isEmpty()) {
            return "可选但强烈建议提供；合法值动态来自 koduck-knowledge 的 domain_dict。当前未注册任何 domain_class。若请求 metadata 已明确给出 domain_class，可省略。";
        }
        return "可选但强烈建议提供；合法值动态来自 koduck-knowledge 的 domain_dict："
                + String.join(", ", domainClasses)
                + "。若请求 metadata 已明确给出 domain_class，可省略。";
    }

    private String writeJson(final ObjectNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("failed to serialize knowledge tool schema", error);
        }
    }
}
