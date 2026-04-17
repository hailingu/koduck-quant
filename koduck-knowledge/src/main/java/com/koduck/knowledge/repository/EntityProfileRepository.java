package com.koduck.knowledge.repository;

import com.koduck.knowledge.entity.EntityProfileEntity;
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
            order by p.version desc
            """)
    Page<EntityProfileEntity> findHistoryByEntityIdAndProfileEntryId(
            @Param("entityId") Long entityId,
            @Param("profileEntryId") Integer profileEntryId,
            Pageable pageable);
}
