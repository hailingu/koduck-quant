package com.koduck.repository;

import com.koduck.entity.SignalSubscription;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 *  Repository
 */
@Repository
public interface SignalSubscriptionRepository extends JpaRepository<SignalSubscription, Long> {

    /**
     *  ID  ID 
     */
    Optional<SignalSubscription> findBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     *  ID 
     */
    Page<SignalSubscription> findByUserId(Long userId, Pageable pageable);

    /**
     *  ID （）
     */
    List<SignalSubscription> findByUserId(Long userId);

    /**
     *  ID 
     */
    List<SignalSubscription> findBySignalId(Long signalId);

    /**
     * 
     */
    long countBySignalId(Long signalId);

    /**
     * 
     */
    long countByUserId(Long userId);

    /**
     * 
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     *  ID 
     */
    @Query("SELECT s.signalId FROM SignalSubscription s WHERE s.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
