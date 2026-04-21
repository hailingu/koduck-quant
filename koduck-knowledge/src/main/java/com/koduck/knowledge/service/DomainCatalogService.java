package com.koduck.knowledge.service;

import com.koduck.knowledge.repository.DomainDictRepository;
import com.koduck.knowledge.repository.ProfileEntryDictRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DomainCatalogService {

    private final DomainDictRepository domainDictRepository;
    private final ProfileEntryDictRepository profileEntryDictRepository;

    public DomainCatalogService(
            final DomainDictRepository domainDictRepository,
            final ProfileEntryDictRepository profileEntryDictRepository) {
        this.domainDictRepository = domainDictRepository;
        this.profileEntryDictRepository = profileEntryDictRepository;
    }

    public List<String> listDomainClasses() {
        return domainDictRepository.findAllByOrderByDomainClassAsc().stream()
                .map(domain -> domain.getDomainClass())
                .toList();
    }

    public List<String> listNonBasicProfileEntryCodes() {
        return profileEntryDictRepository.findAllByIsBasicFalseOrderByCodeAsc().stream()
                .map(entry -> entry.getCode())
                .toList();
    }
}
