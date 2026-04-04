package com.koduck.repository.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.UserMemoryProfile;

/**
 * Repository for UserMemoryProfile entity operations.
 *
 * @author GitHub Copilot
 */
@Repository
public interface UserMemoryProfileRepository extends JpaRepository<UserMemoryProfile, Long> {
}
