package com.koduck.repository;

import com.koduck.entity.SignalLike;
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
public interface SignalLikeRepository extends JpaRepository<SignalLike, Long> {

    /**
     *  ID  ID 
     */
    Optional<SignalLike> findBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     *  ID 
     */
    List<SignalLike> findByUserId(Long userId);

    /**
     *  ID 
     */
    List<SignalLike> findBySignalId(Long signalId);

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
    @Query("SELECT l.signalId FROM SignalLike l WHERE l.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
