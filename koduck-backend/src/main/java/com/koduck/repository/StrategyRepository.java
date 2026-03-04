package com.koduck.repository;

import com.koduck.entity.Strategy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for strategy operations.
 */
@Repository
public interface StrategyRepository extends JpaRepository<Strategy, Long> {
    
    /**
     * Find all strategies for a user.
     */
    List<Strategy> findByUserId(Long userId);
    
    /**
     * Find strategies for a user by status.
     */
    List<Strategy> findByUserIdAndStatus(Long userId, Strategy.StrategyStatus status);
    
    /**
     * Find a strategy by id and user.
     */
    Optional<Strategy> findByIdAndUserId(Long id, Long userId);
    
    /**
     * Check if a strategy exists by id and user.
     */
    boolean existsByIdAndUserId(Long id, Long userId);
    
    /**
     * Delete a strategy by id and user.
     */
    @Modifying
    @Query("DELETE FROM Strategy s WHERE s.id = :id AND s.userId = :userId")
    void deleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);
    
    /**
     * Count strategies for a user.
     */
    long countByUserId(Long userId);
    
    /**
     * Update strategy status.
     */
    @Modifying
    @Query("UPDATE Strategy s SET s.status = :status WHERE s.id = :id AND s.userId = :userId")
    void updateStatus(@Param("id") Long id, @Param("userId") Long userId, @Param("status") Strategy.StrategyStatus status);
    
    /**
     * Increment current version.
     */
    @Modifying
    @Query("UPDATE Strategy s SET s.currentVersion = s.currentVersion + 1 WHERE s.id = :id")
    void incrementVersion(@Param("id") Long id);
}
