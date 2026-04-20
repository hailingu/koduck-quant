package com.koduck.knowledge.service;

import com.koduck.knowledge.repository.DomainDictRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DomainCatalogService {

    private final DomainDictRepository domainDictRepository;

    public DomainCatalogService(final DomainDictRepository domainDictRepository) {
        this.domainDictRepository = domainDictRepository;
    }

    public List<String> listDomainClasses() {
        return domainDictRepository.findAllByOrderByDomainClassAsc().stream()
                .map(domain -> domain.getDomainClass())
                .toList();
    }
}
