package com.koduck.knowledge.repository;

import com.koduck.knowledge.entity.EntityProfileEntity;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface EntityProfileRepository extends Repository<EntityProfileEntity, Long> {

    @Query("""
            select p
            from EntityProfileEntity p
            where p.entityId = :entityId
              and p.profileEntryId = :profileEntryId
              and p.current = true
            """)
    Optional<EntityProfileEntity> findCurrentByEntityIdAndProfileEntryId(
            @Param("entityId") Long entityId,
            @Param("profileEntryId") Integer profileEntryId);

    @Query("""
            select p
            from EntityProfileEntity p
            where p.entityId = :entityId
              and p.profileEntryId = :profileEntryId
              and (
                    ((p.validFrom is null and p.validTo is null) and p.current = true)
                    or (
                        (p.validFrom is null or p.validFrom <= :at)
                        and (p.validTo is null or p.validTo > :at)
                    )
                  )
            order by case when p.current = true then 0 else 1 end asc,
                     p.validFrom desc,
                     p.version desc
            """)
    List<EntityProfileEntity> findAtByEntityIdAndProfileEntryId(
            @Param("entityId") Long entityId,
            @Param("profileEntryId") Integer profileEntryId,
            @Param("at") OffsetDateTime at,
            Pageable pageable);

    @Query("""
            select p
            from EntityProfileEntity p
            where p.entityId = :entityId
              and p.profileEntryId = :profileEntryId
            order by p.version desc
            """)
    Page<EntityProfileEntity> findHistoryByEntityIdAndProfileEntryId(
            @Param("entityId") Long entityId,
            @Param("profileEntryId") Integer profileEntryId,
            Pageable pageable);

    @Query("""
            select p
            from EntityProfileEntity p
            where p.entityId = :entityId
              and p.profileEntryId = :profileEntryId
              and (
                    ((p.validFrom is null and p.validTo is null) and p.current = true)
                    or (p.validTo is null or p.validTo > :from)
                  )
            order by p.version desc
            """)
    Page<EntityProfileEntity> findHistoryOverlappingFromByEntityIdAndProfileEntryId(
            @Param("entityId") Long entityId,
            @Param("profileEntryId") Integer profileEntryId,
            @Param("from") OffsetDateTime from,
            Pageable pageable);

    @Query("""
            select p
            from EntityProfileEntity p
            where p.entityId = :entityId
              and p.profileEntryId = :profileEntryId
              and (
                    ((p.validFrom is null and p.validTo is null) and p.current = true)
                    or (p.validFrom is null or p.validFrom < :to)
                  )
            order by p.version desc
            """)
    Page<EntityProfileEntity> findHistoryOverlappingToByEntityIdAndProfileEntryId(
            @Param("entityId") Long entityId,
            @Param("profileEntryId") Integer profileEntryId,
            @Param("to") OffsetDateTime to,
            Pageable pageable);

    @Query("""
            select p
            from EntityProfileEntity p
            where p.entityId = :entityId
              and p.profileEntryId = :profileEntryId
              and (
                    ((p.validFrom is null and p.validTo is null) and p.current = true)
                    or ((p.validTo is null or p.validTo > :from)
                        and (p.validFrom is null or p.validFrom < :to))
                  )
            order by p.version desc
            """)
    Page<EntityProfileEntity> findHistoryOverlappingWindowByEntityIdAndProfileEntryId(
            @Param("entityId") Long entityId,
            @Param("profileEntryId") Integer profileEntryId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to,
            Pageable pageable);
}
