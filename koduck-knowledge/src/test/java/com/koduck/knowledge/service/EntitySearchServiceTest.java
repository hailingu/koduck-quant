package com.koduck.knowledge.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.koduck.knowledge.dto.MatchType;
import com.koduck.knowledge.entity.DomainDictEntity;
import com.koduck.knowledge.entity.EntityAliasEntity;
import com.koduck.knowledge.entity.EntityBasicProfileEntity;
import com.koduck.knowledge.entity.KnowledgeEntity;
import com.koduck.knowledge.repository.EntityAliasRepository;
import com.koduck.knowledge.repository.EntityBasicProfileRepository;
import com.koduck.knowledge.repository.EntityRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EntitySearchServiceTest {

    @Mock
    private EntityRepository entityRepository;

    @Mock
    private EntityAliasRepository entityAliasRepository;

    @Mock
    private EntityBasicProfileRepository entityBasicProfileRepository;

    @Mock
    private DictionaryResolver dictionaryResolver;

    private EntitySearchService entitySearchService;

    @BeforeEach
    void setUp() {
        entitySearchService = new EntitySearchService(
                entityRepository,
                entityAliasRepository,
                entityBasicProfileRepository,
                dictionaryResolver,
                Clock.fixed(Instant.parse("2026-04-17T08:00:00Z"), ZoneOffset.UTC),
                new SimpleMeterRegistry());
    }

    @Test
    void shouldReturnSortedHitsWithDuplicatesAllowed() {
        final DomainDictEntity domain = new DomainDictEntity();
        domain.setDomainClass("finance");
        when(dictionaryResolver.resolveDomainClass("finance")).thenReturn(domain);

        final KnowledgeEntity entity = new KnowledgeEntity();
        entity.setEntityId(100L);
        entity.setCanonicalName("alice");
        when(entityRepository.findByCanonicalName("alice")).thenReturn(List.of(entity));
        when(entityRepository.findByCanonicalNamePrefix("alice")).thenReturn(List.of(entity));
        when(entityRepository.findByEntityId(100L)).thenReturn(Optional.of(entity));

        final EntityAliasEntity alias = new EntityAliasEntity();
        alias.setAliasId(1L);
        alias.setEntityId(100L);
        alias.setAlias("alice");
        when(entityAliasRepository.findByAlias("alice")).thenReturn(List.of(alias));
        when(entityAliasRepository.findByAliasPrefix("alice")).thenReturn(List.of());

        final EntityBasicProfileEntity basic = new EntityBasicProfileEntity();
        basic.setEntityId(100L);
        basic.setDomainClass("finance");
        basic.setEntityName("Alice Zhang");
        basic.setValidFrom(OffsetDateTime.parse("2025-01-01T00:00:00Z"));
        basic.setBasicProfileS3Uri("s3://bucket/basic.json");
        when(entityBasicProfileRepository.findCurrentAt(eq(100L), eq("finance"), any()))
                .thenReturn(Optional.of(basic));

        final var hits = entitySearchService.search("Alice", "finance", null);

        assertEquals(3, hits.size());
        assertEquals(List.of(MatchType.CANONICAL_EXACT, MatchType.ALIAS_EXACT, MatchType.CANONICAL_PREFIX),
                hits.stream().map(hit -> hit.matchType()).toList());
    }
}
