package com.koduck.repository;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.UserSettings;

/**
 *  Repository
 */
@Repository
public interface UserSettingsRepository extends JpaRepository<UserSettings, Long> {

    /**
     * ID
     */
    Optional<UserSettings> findByUserId(Long userId);

    /**
     * 
     */
    boolean existsByUserId(Long userId);

    /**
     * 
     */
    void deleteByUserId(Long userId);
}
