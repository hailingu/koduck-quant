package com.koduck.knowledge.repository;

import com.koduck.knowledge.entity.ProfileEntryDictEntity;
import java.util.Optional;
import org.springframework.data.repository.Repository;

public interface ProfileEntryDictRepository extends Repository<ProfileEntryDictEntity, Integer> {

    Optional<ProfileEntryDictEntity> findByCode(String code);
}
