package com.koduck.knowledge.api;

import com.koduck.knowledge.dto.KnowledgeDomainCatalogView;
import com.koduck.knowledge.service.DomainCatalogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
public class InternalDomainCatalogController {

    private final DomainCatalogService domainCatalogService;

    public InternalDomainCatalogController(final DomainCatalogService domainCatalogService) {
        this.domainCatalogService = domainCatalogService;
    }

    @GetMapping("/domain-classes")
    public KnowledgeDomainCatalogView getDomainClasses() {
        return new KnowledgeDomainCatalogView(
                "koduck-knowledge",
                domainCatalogService.listDomainClasses());
    }
}
