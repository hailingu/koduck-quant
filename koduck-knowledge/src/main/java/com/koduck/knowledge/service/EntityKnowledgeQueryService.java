package com.koduck.knowledge.service;

import com.koduck.knowledge.dto.BasicProfileSegment;
import com.koduck.knowledge.dto.BasicProfileView;
import com.koduck.knowledge.dto.EntityFactView;
import com.koduck.knowledge.dto.FactsRequest;
import com.koduck.knowledge.dto.PageView;
import com.koduck.knowledge.dto.ProfileDetailView;
import com.koduck.knowledge.dto.ProfileVersionView;
import com.koduck.knowledge.entity.EntityBasicProfileEntity;
import com.koduck.knowledge.entity.EntityProfileEntity;
import com.koduck.knowledge.entity.KnowledgeEntity;
import com.koduck.knowledge.entity.ProfileEntryDictEntity;
import com.koduck.knowledge.exception.KnowledgeException;
import com.koduck.knowledge.repository.EntityBasicProfileRepository;
import com.koduck.knowledge.repository.EntityProfileRepository;
import com.koduck.knowledge.repository.EntityRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class EntityKnowledgeQueryService {

    private final EntityRepository entityRepository;
    private final EntityBasicProfileRepository entityBasicProfileRepository;
    private final EntityProfileRepository entityProfileRepository;
    private final DictionaryResolver dictionaryResolver;
    private final Clock clock;
    private final Counter throughputCounter;
    private final Timer profileReadTimer;

    public EntityKnowledgeQueryService(
            final EntityRepository entityRepository,
            final EntityBasicProfileRepository entityBasicProfileRepository,
            final EntityProfileRepository entityProfileRepository,
            final DictionaryResolver dictionaryResolver,
            final Clock clock,
            final MeterRegistry meterRegistry) {
        this.entityRepository = entityRepository;
        this.entityBasicProfileRepository = entityBasicProfileRepository;
        this.entityProfileRepository = entityProfileRepository;
        this.dictionaryResolver = dictionaryResolver;
        this.clock = clock;
        this.throughputCounter = meterRegistry.counter("knowledge_query_throughput");
        this.profileReadTimer = meterRegistry.timer("knowledge_profile_read_latency_ms");
    }

    public List<EntityFactView> facts(final FactsRequest request) {
        throughputCounter.increment();
        final String domainClass = dictionaryResolver.resolveDomainClass(request.getDomainClass()).getDomainClass();
        final OffsetDateTime at = request.getAt() != null ? request.getAt() : OffsetDateTime.now(clock);
        final List<ProfileEntryDictEntity> requestedEntries =
                dictionaryResolver.resolveNonBasicProfileEntryCodes(request.getProfileEntryCodes());
        final List<EntityFactView> result = new ArrayList<>();
        for (final Long entityId : request.getEntityIds()) {
            final EntityBasicProfileEntity basic = entityBasicProfileRepository.findCurrentAt(entityId, domainClass, at)
                    .orElse(null);
            if (basic == null) {
                continue;
            }
            final List<EntityFactView> entityRows = new ArrayList<>();
            entityRows.add(new EntityFactView(
                    entityId,
                    domainClass,
                    basic.getEntityName(),
                    basic.getBasicProfileS3Uri(),
                    basic.getValidFrom(),
                    basic.getValidTo(),
                    null,
                    null));
            boolean complete = true;
            for (final ProfileEntryDictEntity entry : requestedEntries) {
                final EntityProfileEntity detail = entityProfileRepository.findCurrentByEntityIdAndProfileEntryId(
                                entityId, entry.getProfileEntryId())
                        .orElse(null);
                if (detail == null) {
                    complete = false;
                    break;
                }
                entityRows.add(new EntityFactView(
                        entityId,
                        domainClass,
                        basic.getEntityName(),
                        basic.getBasicProfileS3Uri(),
                        basic.getValidFrom(),
                        basic.getValidTo(),
                        entry.getCode(),
                        detail.getBlobUri()));
            }
            if (complete) {
                result.addAll(entityRows);
            }
        }
        return result;
    }

    public BasicProfileView getBasicProfile(final long entityId, final String domainClass, final OffsetDateTime at) {
        return profileReadTimer.record(() -> {
            throughputCounter.increment();
            final OffsetDateTime queryAt = at != null ? at : OffsetDateTime.now(clock);
            dictionaryResolver.resolveDomainClass(domainClass);
            final KnowledgeEntity entity = requireEntity(entityId);
            final EntityBasicProfileEntity profile = entityBasicProfileRepository.findCurrentAt(entityId, domainClass, queryAt)
                    .orElseThrow(() -> new KnowledgeException(
                            HttpStatus.NOT_FOUND,
                            "BASIC_PROFILE_NOT_FOUND",
                            "No basic profile found"));
            return new BasicProfileView(
                    entityId,
                    entity.getCanonicalName(),
                    profile.getEntityName(),
                    profile.getDomainClass(),
                    profile.getValidFrom(),
                    profile.getValidTo(),
                    profile.getBasicProfileS3Uri());
        });
    }

    public ProfileDetailView getProfileDetail(final long entityId, final String entryCode) {
        return profileReadTimer.record(() -> {
            throughputCounter.increment();
            requireEntity(entityId);
            final ProfileEntryDictEntity entry = dictionaryResolver.resolveNonBasicEntryPathCode(entryCode);
            final EntityProfileEntity profile = entityProfileRepository
                    .findCurrentByEntityIdAndProfileEntryId(entityId, entry.getProfileEntryId())
                    .orElseThrow(() -> new KnowledgeException(
                            HttpStatus.NOT_FOUND,
                            "PROFILE_NOT_FOUND",
                            "No current profile found"));
            return new ProfileDetailView(
                    entityId,
                    entry.getCode(),
                    profile.getVersion(),
                    profile.isCurrent(),
                    profile.getBlobUri(),
                    profile.getLoadedAt());
        });
    }

    public PageView<BasicProfileSegment> getBasicProfileHistory(
            final long entityId,
            final String domainClass,
            final int page,
            final int size) {
        throughputCounter.increment();
        dictionaryResolver.resolveDomainClass(domainClass);
        requireEntity(entityId);
        final PageRequest pageRequest = pageRequest(page, size);
        final var pageResult = entityBasicProfileRepository.findHistoryByEntityIdAndDomainClass(
                entityId, domainClass, pageRequest);
        return new PageView<>(
                pageResult.getContent().stream()
                        .map(profile -> new BasicProfileSegment(
                                profile.getEntityId(),
                                profile.getDomainClass(),
                                profile.getEntityName(),
                                profile.getValidFrom(),
                                profile.getValidTo(),
                                profile.getBasicProfileS3Uri()))
                        .toList(),
                page,
                size,
                pageResult.getTotalElements());
    }

    public PageView<ProfileVersionView> getProfileHistory(
            final long entityId,
            final String entryCode,
            final int page,
            final int size) {
        throughputCounter.increment();
        requireEntity(entityId);
        final ProfileEntryDictEntity entry = dictionaryResolver.resolveNonBasicEntryPathCode(entryCode);
        final PageRequest pageRequest = pageRequest(page, size);
        final var pageResult = entityProfileRepository.findHistoryByEntityIdAndProfileEntryId(
                entityId, entry.getProfileEntryId(), pageRequest);
        return new PageView<>(
                pageResult.getContent().stream()
                        .map(profile -> new ProfileVersionView(
                                profile.getEntityId(),
                                entry.getCode(),
                                profile.getVersion(),
                                profile.isCurrent(),
                                profile.getBlobUri(),
                                profile.getLoadedAt()))
                        .toList(),
                page,
                size,
                pageResult.getTotalElements());
    }

    private KnowledgeEntity requireEntity(final long entityId) {
        return entityRepository.findByEntityId(entityId)
                .orElseThrow(() -> new KnowledgeException(
                        HttpStatus.NOT_FOUND,
                        "ENTITY_NOT_FOUND",
                        "Entity not found: " + entityId));
    }

    private PageRequest pageRequest(final int page, final int size) {
        if (page < 1 || size < 1 || size > 100) {
            throw new KnowledgeException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_PAGINATION",
                    "page must be >= 1 and size must be between 1 and 100");
        }
        return PageRequest.of(page - 1, size);
    }
}
