package com.koduck.knowledge.api;

import com.koduck.knowledge.dto.KnowledgeToolCatalogView;
import com.koduck.knowledge.dto.KnowledgeToolDefinitionView;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
public class InternalToolCatalogController {

    @GetMapping("/tools")
    public KnowledgeToolCatalogView getTools() {
        return new KnowledgeToolCatalogView(
                "koduck-knowledge",
                List.of(new KnowledgeToolDefinitionView(
                        "query_knowledge",
                        "v1",
                        "用于检索 koduck-knowledge 的结构化实体知识。只有当你需要做实体对齐、候选实体搜索，或者读取基础档案与只读 facts 时，才调用这个工具。若请求上下文里已有明确 domain_class，应显式传入；如果没有，就不要臆造 domain_class。",
                        """
                        {"type":"object","properties":{"query":{"type":"string","description":"要检索的实体名称、公司名、人物名或主题关键词。"},"domain_class":{"type":"string","description":"可选但强烈建议提供；知识库 domain_class，例如 literature、history、food。若当前请求 metadata 已明确给出 domain_class，可省略。"}},"required":["query"],"additionalProperties":false}
                        """,
                        """
                        {"type":"object","properties":{"hits":{"type":"array","description":"知识库返回的候选实体列表。"},"primaryProfile":{"type":"object","description":"首个候选实体的基础档案。"},"facts":{"type":"array","description":"围绕候选实体展开的只读 facts。"}}}
                        """,
                        5000,
                        "knowledge.read",
                        false)));
    }
}
