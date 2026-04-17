package com.koduck.knowledge.repository;

import com.koduck.knowledge.entity.EntityAliasEntity;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface EntityAliasRepository extends Repository<EntityAliasEntity, Long> {

    @Query("select a from EntityAliasEntity a where lower(a.alias) = lower(:alias)")
    List<EntityAliasEntity> findByAlias(@Param("alias") String alias);

    @Query("select a from EntityAliasEntity a where lower(a.alias) like lower(concat(:prefix, '%'))")
    List<EntityAliasEntity> findByAliasPrefix(@Param("prefix") String prefix);
}
