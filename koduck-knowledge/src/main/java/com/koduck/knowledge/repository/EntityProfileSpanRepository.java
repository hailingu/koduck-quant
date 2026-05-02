package com.koduck.knowledge.repository;

import com.koduck.knowledge.entity.EntityProfileSpanEntity;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface EntityProfileSpanRepository extends Repository<EntityProfileSpanEntity, Long> {

    @Query("""
            select s
            from EntityProfileSpanEntity s
            where s.entityId = :entityId
            order by s.spanFrom asc, s.sortOrder asc, s.spanId asc
            """)
    List<EntityProfileSpanEntity> findByEntityId(@Param("entityId") Long entityId);

    @Query("""
            select s
            from EntityProfileSpanEntity s
            where s.entityId = :entityId
              and (s.spanTo is null or s.spanTo > :from)
            order by s.spanFrom asc, s.sortOrder asc, s.spanId asc
            """)
    List<EntityProfileSpanEntity> findOverlappingFromByEntityId(
            @Param("entityId") Long entityId,
            @Param("from") OffsetDateTime from);

    @Query("""
            select s
            from EntityProfileSpanEntity s
            where s.entityId = :entityId
              and (s.spanFrom is null or s.spanFrom < :to)
            order by s.spanFrom asc, s.sortOrder asc, s.spanId asc
            """)
    List<EntityProfileSpanEntity> findOverlappingToByEntityId(
            @Param("entityId") Long entityId,
            @Param("to") OffsetDateTime to);

    @Query("""
            select s
            from EntityProfileSpanEntity s
            where s.entityId = :entityId
              and (s.spanTo is null or s.spanTo > :from)
              and (s.spanFrom is null or s.spanFrom < :to)
            order by s.spanFrom asc, s.sortOrder asc, s.spanId asc
            """)
    List<EntityProfileSpanEntity> findOverlappingWindowByEntityId(
            @Param("entityId") Long entityId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);
}
