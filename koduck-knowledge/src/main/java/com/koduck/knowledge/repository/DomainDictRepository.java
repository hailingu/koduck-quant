package com.koduck.knowledge.repository;

import com.koduck.knowledge.entity.DomainDictEntity;
import java.util.Optional;
import org.springframework.data.repository.Repository;

public interface DomainDictRepository extends Repository<DomainDictEntity, String> {

    Optional<DomainDictEntity> findByDomainClass(String domainClass);
}
