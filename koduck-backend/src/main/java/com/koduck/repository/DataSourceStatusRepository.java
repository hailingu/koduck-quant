package com.koduck.repository;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.koduck.entity.DataSourceStatus;

/**
 * Repository for data source status.
 */
@Repository
public interface DataSourceStatusRepository extends JpaRepository<DataSourceStatus, Long> {
    
    /**
     * Find data source by name.
     */
    Optional<DataSourceStatus> findBySourceName(String sourceName);
    
    /**
     * Find all data sources with a specific status.
     */
    List<DataSourceStatus> findByStatus(String status);
    
    /**
     * Find unhealthy data sources (not HEALTHY).
     */
    @Query("SELECT d FROM DataSourceStatus d WHERE d.status != 'HEALTHY'")
    List<DataSourceStatus> findUnhealthySources();
    
    /**
     * Find data sources with high failure count.
     */
    @Query("SELECT d FROM DataSourceStatus d WHERE d.consecutiveFailures >= :threshold")
    List<DataSourceStatus> findSourcesWithHighFailures(int threshold);
}
