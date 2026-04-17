package com.koduck.knowledge.service;

import com.koduck.knowledge.entity.DomainDictEntity;
import com.koduck.knowledge.entity.ProfileEntryDictEntity;
import com.koduck.knowledge.exception.KnowledgeException;
import com.koduck.knowledge.repository.DomainDictRepository;
import com.koduck.knowledge.repository.ProfileEntryDictRepository;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class DictionaryResolver {

    private final DomainDictRepository domainDictRepository;
    private final ProfileEntryDictRepository profileEntryDictRepository;

    public DictionaryResolver(
            final DomainDictRepository domainDictRepository,
            final ProfileEntryDictRepository profileEntryDictRepository) {
        this.domainDictRepository = domainDictRepository;
        this.profileEntryDictRepository = profileEntryDictRepository;
    }

    public DomainDictEntity resolveDomainClass(final String domainClass) {
        final String normalized = requireNonBlank(domainClass, "domainClass");
        return domainDictRepository.findByDomainClass(normalized)
                .orElseThrow(() -> new KnowledgeException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_DOMAIN_CLASS",
                        "Unknown domainClass: " + normalized));
    }

    public ProfileEntryDictEntity resolveProfileEntryCode(final String code) {
        final String normalized = requireUpperCode(code);
        return profileEntryDictRepository.findByCode(normalized)
                .orElseThrow(() -> new KnowledgeException(
                        HttpStatus.NOT_FOUND,
                        "PROFILE_ENTRY_NOT_FOUND",
                        "Unknown profile entry: " + normalized));
    }

    public List<ProfileEntryDictEntity> resolveNonBasicProfileEntryCodes(final List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return List.of();
        }
        final Set<String> uniqueCodes = new LinkedHashSet<>();
        for (final String code : codes) {
            uniqueCodes.add(requireUpperCode(code));
        }
        final List<ProfileEntryDictEntity> resolved = new ArrayList<>();
        for (final String code : uniqueCodes) {
            final ProfileEntryDictEntity entry = profileEntryDictRepository.findByCode(code)
                    .orElseThrow(() -> new KnowledgeException(
                            HttpStatus.BAD_REQUEST,
                            "INVALID_PROFILE_ENTRY_CODE",
                            "Unknown profile entry: " + code));
            if (entry.isBasic()) {
                throw new KnowledgeException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_PROFILE_ENTRY_CODE",
                        "BASIC is not allowed in profileEntryCodes");
            }
            resolved.add(entry);
        }
        return resolved;
    }

    public ProfileEntryDictEntity resolveNonBasicEntryPathCode(final String code) {
        final ProfileEntryDictEntity entry = resolveProfileEntryCode(code);
        if (entry.isBasic()) {
            throw new KnowledgeException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_PROFILE_ENTRY_PATH",
                    "BASIC is not allowed on detail or history paths");
        }
        return entry;
    }

    private String requireNonBlank(final String value, final String fieldName) {
        if (value == null || value.isBlank()) {
            throw new KnowledgeException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_ARGUMENT",
                    fieldName + " is required");
        }
        return value.trim();
    }

    private String requireUpperCode(final String code) {
        return requireNonBlank(code, "entry_code").trim().toUpperCase(Locale.ROOT);
    }
}
