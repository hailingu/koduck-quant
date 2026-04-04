package com.koduck.repository.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.user.UserSettings;

/**
 * Repository for UserSettings operations.
 *
 * @author Koduck Team
 */
@Repository
public interface UserSettingsRepository extends JpaRepository<UserSettings, Long> {

    /**
     * Find user settings by user ID.
     *
     * @param userId the user id
     * @return optional of user settings
     */
    Optional<UserSettings> findByUserId(Long userId);

    /**
     * Check if user settings exists by user ID.
     *
     * @param userId the user id
     * @return true if exists, false otherwise
     */
    boolean existsByUserId(Long userId);

    /**
     * Delete user settings by user ID.
     *
     * @param userId the user id
     */
    void deleteByUserId(Long userId);
}
