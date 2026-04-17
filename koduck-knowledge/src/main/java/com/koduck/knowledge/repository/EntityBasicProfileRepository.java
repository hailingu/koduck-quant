package com.koduck.knowledge.repository;

import com.koduck.knowledge.entity.EntityBasicProfileEntity;
import com.koduck.knowledge.entity.EntityBasicProfileId;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface EntityBasicProfileRepository
        extends Repository<EntityBasicProfileEntity, EntityBasicProfileId> {

    @Query("""
            select p
            from EntityBasicProfileEntity p
            where p.entityId = :entityId
              and p.domainClass = :domainClass
              and p.validFrom <= :at
              and (p.validTo is null or p.validTo > :at)
            order by p.validFrom desc
            """)
    Optional<EntityBasicProfileEntity> findCurrentAt(
            @Param("entityId") Long entityId,
            @Param("domainClass") String domainClass,
            @Param("at") OffsetDateTime at);

    @Query("""
            select p
            from EntityBasicProfileEntity p
            where p.entityId = :entityId
              and p.domainClass = :domainClass
            order by p.validFrom desc
            """)
    Page<EntityBasicProfileEntity> findHistoryByEntityIdAndDomainClass(
            @Param("entityId") Long entityId,
            @Param("domainClass") String domainClass,
            Pageable pageable);
}
