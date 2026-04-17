package com.koduck.knowledge.service;

import com.koduck.knowledge.dto.MatchType;
import com.koduck.knowledge.dto.SearchHit;
import com.koduck.knowledge.entity.EntityAliasEntity;
import com.koduck.knowledge.entity.EntityBasicProfileEntity;
import com.koduck.knowledge.entity.KnowledgeEntity;
import com.koduck.knowledge.repository.EntityAliasRepository;
import com.koduck.knowledge.repository.EntityBasicProfileRepository;
import com.koduck.knowledge.repository.EntityRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.text.Normalizer;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class EntitySearchService {

    private final EntityRepository entityRepository;
    private final EntityAliasRepository entityAliasRepository;
    private final EntityBasicProfileRepository entityBasicProfileRepository;
    private final DictionaryResolver dictionaryResolver;
    private final Clock clock;
    private final Timer searchTimer;

    public EntitySearchService(
            final EntityRepository entityRepository,
            final EntityAliasRepository entityAliasRepository,
            final EntityBasicProfileRepository entityBasicProfileRepository,
            final DictionaryResolver dictionaryResolver,
            final Clock clock,
            final MeterRegistry meterRegistry) {
        this.entityRepository = entityRepository;
        this.entityAliasRepository = entityAliasRepository;
        this.entityBasicProfileRepository = entityBasicProfileRepository;
        this.dictionaryResolver = dictionaryResolver;
        this.clock = clock;
        this.searchTimer = meterRegistry.timer("knowledge_search_latency_ms");
    }

    public List<SearchHit> search(final String name, final String domainClass, final OffsetDateTime at) {
        return searchTimer.record(() -> doSearch(name, domainClass, at));
    }

    private List<SearchHit> doSearch(final String name, final String domainClass, final OffsetDateTime at) {
        dictionaryResolver.resolveDomainClass(domainClass);
        if (name == null || name.isBlank()) {
            throw new com.koduck.knowledge.exception.KnowledgeException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "INVALID_ARGUMENT",
                    "name is required");
        }
        final String normalizedName = normalize(name);
        final OffsetDateTime queryAt = at != null ? at : OffsetDateTime.now(clock);

        final List<SearchCandidate> candidates = new ArrayList<>();
        appendCandidates(candidates, entityRepository.findByCanonicalName(normalizedName), MatchType.CANONICAL_EXACT);
        appendAliasCandidates(candidates, entityAliasRepository.findByAlias(normalizedName), MatchType.ALIAS_EXACT);
        appendCandidates(candidates, entityRepository.findByCanonicalNamePrefix(normalizedName), MatchType.CANONICAL_PREFIX);
        appendAliasCandidates(candidates, entityAliasRepository.findByAliasPrefix(normalizedName), MatchType.ALIAS_PREFIX);

        return candidates.stream()
                .map(candidate -> toSearchHit(candidate, domainClass, queryAt))
                .flatMap(Optional::stream)
                .sorted(Comparator.comparingInt((SearchHit hit) -> priority(hit.matchType()))
                        .thenComparingLong(SearchHit::entityId))
                .toList();
    }

    private void appendCandidates(
            final List<SearchCandidate> candidates,
            final List<KnowledgeEntity> entities,
            final MatchType matchType) {
        for (final KnowledgeEntity entity : entities) {
            candidates.add(new SearchCandidate(entity.getEntityId(), entity.getCanonicalName(), matchType));
        }
    }

    private void appendAliasCandidates(
            final List<SearchCandidate> candidates,
            final List<EntityAliasEntity> aliases,
            final MatchType matchType) {
        for (final EntityAliasEntity alias : aliases) {
            entityRepository.findByEntityId(alias.getEntityId())
                    .ifPresent(entity -> candidates.add(
                            new SearchCandidate(entity.getEntityId(), entity.getCanonicalName(), matchType)));
        }
    }

    private Optional<SearchHit> toSearchHit(
            final SearchCandidate candidate,
            final String domainClass,
            final OffsetDateTime at) {
        return entityBasicProfileRepository.findCurrentAt(candidate.entityId(), domainClass, at)
                .map(profile -> new SearchHit(
                        candidate.entityId(),
                        candidate.canonicalName(),
                        profile.getEntityName(),
                        candidate.matchType(),
                        profile.getBasicProfileS3Uri(),
                        profile.getValidFrom(),
                        profile.getValidTo()));
    }

    private String normalize(final String value) {
        return Normalizer.normalize(value == null ? "" : value.trim(), Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT);
    }

    private int priority(final MatchType matchType) {
        return switch (matchType) {
            case CANONICAL_EXACT -> 0;
            case ALIAS_EXACT -> 1;
            case CANONICAL_PREFIX -> 2;
            case ALIAS_PREFIX -> 3;
        };
    }

    private record SearchCandidate(long entityId, String canonicalName, MatchType matchType) {
    }
}
