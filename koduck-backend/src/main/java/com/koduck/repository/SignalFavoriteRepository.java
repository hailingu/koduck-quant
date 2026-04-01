package com.koduck.repository;

import com.koduck.entity.SignalFavorite;
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
public interface SignalFavoriteRepository extends JpaRepository<SignalFavorite, Long> {

    /**
     *  ID  ID 
     */
    Optional<SignalFavorite> findBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     *  ID （）
     */
    Page<SignalFavorite> findByUserId(Long userId, Pageable pageable);

    /**
     *  ID 
     */
    List<SignalFavorite> findByUserId(Long userId);

    /**
     *  ID 
     */
    List<SignalFavorite> findBySignalId(Long signalId);

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
    @Query("SELECT f.signalId FROM SignalFavorite f WHERE f.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
