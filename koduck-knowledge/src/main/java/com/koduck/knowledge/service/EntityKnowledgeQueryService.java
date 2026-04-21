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
import java.util.stream.Collectors;
import org.apache.logging.log4j.ThreadContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class EntityKnowledgeQueryService {

    private static final Logger log = LoggerFactory.getLogger(EntityKnowledgeQueryService.class);

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
        ThreadContext.put("domain_class", domainClass);
        ThreadContext.put("entity_id", summarizeEntityIds(request.getEntityIds()));
        final OffsetDateTime at = request.getAt() != null ? request.getAt() : OffsetDateTime.now(clock);
        final List<ProfileEntryDictEntity> requestedEntries =
                dictionaryResolver.resolveNonBasicProfileEntryCodes(request.getProfileEntryCodes());
        ThreadContext.put("profile_entry_id", summarizeEntryCodes(requestedEntries));
        log.info(
                "knowledge facts started entity_ids={} domain_class={} at={} requested_entries={}",
                summarizeEntityIds(request.getEntityIds()),
                domainClass,
                at,
                summarizeEntryCodes(requestedEntries));
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
        log.info(
                "knowledge facts completed entity_ids={} domain_class={} row_count={} returned_entities={} returned_entries={}",
                summarizeEntityIds(request.getEntityIds()),
                domainClass,
                result.size(),
                summarizeReturnedEntities(result),
                summarizeReturnedEntryCodes(result));
        return result;
    }

    public BasicProfileView getBasicProfile(final long entityId, final String domainClass, final OffsetDateTime at) {
        return profileReadTimer.record(() -> {
            throughputCounter.increment();
            final OffsetDateTime queryAt = at != null ? at : OffsetDateTime.now(clock);
            final String resolvedDomainClass = dictionaryResolver.resolveDomainClass(domainClass).getDomainClass();
            ThreadContext.put("entity_id", Long.toString(entityId));
            ThreadContext.put("domain_class", resolvedDomainClass);
            log.info(
                    "knowledge basic profile started entity_id={} domain_class={} at={}",
                    entityId,
                    resolvedDomainClass,
                    queryAt);
            final KnowledgeEntity entity = requireEntity(entityId);
            final EntityBasicProfileEntity profile = entityBasicProfileRepository
                    .findCurrentAt(entityId, resolvedDomainClass, queryAt)
                    .orElseThrow(() -> new KnowledgeException(
                            HttpStatus.NOT_FOUND,
                            "BASIC_PROFILE_NOT_FOUND",
                            "No basic profile found"));
            final BasicProfileView view = new BasicProfileView(
                    entityId,
                    entity.getCanonicalName(),
                    profile.getEntityName(),
                    profile.getDomainClass(),
                    profile.getValidFrom(),
                    profile.getValidTo(),
                    profile.getBasicProfileS3Uri());
            log.info(
                    "knowledge basic profile completed entity_id={} domain_class={} canonical_name={} entity_name={} basic_profile_uri={}",
                    entityId,
                    resolvedDomainClass,
                    entity.getCanonicalName(),
                    profile.getEntityName(),
                    profile.getBasicProfileS3Uri());
            return view;
        });
    }

    public ProfileDetailView getProfileDetail(final long entityId, final String entryCode) {
        return profileReadTimer.record(() -> {
            throughputCounter.increment();
            ThreadContext.put("entity_id", Long.toString(entityId));
            ThreadContext.put("profile_entry_id", entryCode);
            log.info("knowledge profile detail started entity_id={} entry_code={}", entityId, entryCode);
            requireEntity(entityId);
            final ProfileEntryDictEntity entry = dictionaryResolver.resolveNonBasicEntryPathCode(entryCode);
            ThreadContext.put("profile_entry_id", entry.getCode());
            final EntityProfileEntity profile = entityProfileRepository
                    .findCurrentByEntityIdAndProfileEntryId(entityId, entry.getProfileEntryId())
                    .orElseThrow(() -> new KnowledgeException(
                            HttpStatus.NOT_FOUND,
                            "PROFILE_NOT_FOUND",
                            "No current profile found"));
            final ProfileDetailView view = new ProfileDetailView(
                    entityId,
                    entry.getCode(),
                    profile.getVersion(),
                    profile.isCurrent(),
                    profile.getBlobUri(),
                    profile.getLoadedAt());
            log.info(
                    "knowledge profile detail completed entity_id={} entry_code={} version={} blob_uri={} loaded_at={}",
                    entityId,
                    entry.getCode(),
                    profile.getVersion(),
                    profile.getBlobUri(),
                    profile.getLoadedAt());
            return view;
        });
    }

    public PageView<BasicProfileSegment> getBasicProfileHistory(
            final long entityId,
            final String domainClass,
            final int page,
            final int size) {
        throughputCounter.increment();
        final String resolvedDomainClass = dictionaryResolver.resolveDomainClass(domainClass).getDomainClass();
        ThreadContext.put("entity_id", Long.toString(entityId));
        ThreadContext.put("domain_class", resolvedDomainClass);
        log.info(
                "knowledge basic profile history started entity_id={} domain_class={} page={} size={}",
                entityId,
                resolvedDomainClass,
                page,
                size);
        requireEntity(entityId);
        final PageRequest pageRequest = pageRequest(page, size);
        final var pageResult = entityBasicProfileRepository.findHistoryByEntityIdAndDomainClass(
                entityId, resolvedDomainClass, pageRequest);
        final PageView<BasicProfileSegment> view = new PageView<>(
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
        log.info(
                "knowledge basic profile history completed entity_id={} domain_class={} page={} size={} item_count={} total={}",
                entityId,
                resolvedDomainClass,
                page,
                size,
                view.items().size(),
                view.total());
        return view;
    }

    public PageView<ProfileVersionView> getProfileHistory(
            final long entityId,
            final String entryCode,
            final int page,
            final int size) {
        throughputCounter.increment();
        ThreadContext.put("entity_id", Long.toString(entityId));
        ThreadContext.put("profile_entry_id", entryCode);
        log.info(
                "knowledge profile history started entity_id={} entry_code={} page={} size={}",
                entityId,
                entryCode,
                page,
                size);
        requireEntity(entityId);
        final ProfileEntryDictEntity entry = dictionaryResolver.resolveNonBasicEntryPathCode(entryCode);
        ThreadContext.put("profile_entry_id", entry.getCode());
        final PageRequest pageRequest = pageRequest(page, size);
        final var pageResult = entityProfileRepository.findHistoryByEntityIdAndProfileEntryId(
                entityId, entry.getProfileEntryId(), pageRequest);
        final PageView<ProfileVersionView> view = new PageView<>(
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
        log.info(
                "knowledge profile history completed entity_id={} entry_code={} page={} size={} item_count={} total={}",
                entityId,
                entry.getCode(),
                page,
                size,
                view.items().size(),
                view.total());
        return view;
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

    private String summarizeEntityIds(final List<Long> entityIds) {
        if (entityIds == null || entityIds.isEmpty()) {
            return "[]";
        }
        return entityIds.stream()
                .limit(8)
                .map(String::valueOf)
                .collect(Collectors.joining(",", "[", entityIds.size() > 8 ? ",...]" : "]"));
    }

    private String summarizeEntryCodes(final List<ProfileEntryDictEntity> entries) {
        if (entries == null || entries.isEmpty()) {
            return "[]";
        }
        return entries.stream()
                .map(ProfileEntryDictEntity::getCode)
                .collect(Collectors.joining(",", "[", "]"));
    }

    private String summarizeReturnedEntities(final List<EntityFactView> rows) {
        if (rows.isEmpty()) {
            return "[]";
        }
        return rows.stream()
                .map(EntityFactView::entityId)
                .distinct()
                .limit(8)
                .map(String::valueOf)
                .collect(Collectors.joining(",", "[", rows.stream().map(EntityFactView::entityId).distinct().count() > 8 ? ",...]" : "]"));
    }

    private String summarizeReturnedEntryCodes(final List<EntityFactView> rows) {
        final List<String> entryCodes = rows.stream()
                .map(EntityFactView::profileEntryCode)
                .filter(code -> code != null && !code.isBlank())
                .distinct()
                .toList();
        if (entryCodes.isEmpty()) {
            return "[]";
        }
        return entryCodes.stream().collect(Collectors.joining(",", "[", "]"));
    }
}
