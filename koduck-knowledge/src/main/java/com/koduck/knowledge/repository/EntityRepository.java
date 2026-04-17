package com.koduck.knowledge.repository;

import com.koduck.knowledge.entity.KnowledgeEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface EntityRepository extends Repository<KnowledgeEntity, Long> {

    @Query("select e from KnowledgeEntity e where lower(e.canonicalName) = lower(:name)")
    List<KnowledgeEntity> findByCanonicalName(@Param("name") String name);

    @Query("select e from KnowledgeEntity e where lower(e.canonicalName) like lower(concat(:prefix, '%'))")
    List<KnowledgeEntity> findByCanonicalNamePrefix(@Param("prefix") String prefix);

    Optional<KnowledgeEntity> findByEntityId(Long entityId);
}
