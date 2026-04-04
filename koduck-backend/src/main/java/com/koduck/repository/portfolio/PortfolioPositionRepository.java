package com.koduck.repository.portfolio;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.PortfolioPosition;

/**
 * Repository for portfolio position operations.
 *
 * @author Koduck Team
 */
@Repository
public interface PortfolioPositionRepository extends JpaRepository<PortfolioPosition, Long> {

    /**
     * Find all positions for a user.
     *
     * @param userId the user id
     * @return the list of portfolio positions
     */
    List<PortfolioPosition> findByUserId(Long userId);

    /**
     * Find a specific position by user and symbol.
     *
     * @param userId the user id
     * @param market the market
     * @param symbol the symbol
     * @return the optional of portfolio position
     */
    Optional<PortfolioPosition> findByUserIdAndMarketAndSymbol(Long userId, String market, String symbol);

    /**
     * Check if a position exists for user and symbol.
     *
     * @param userId the user id
     * @param market the market
     * @param symbol the symbol
     * @return true if exists, false otherwise
     */
    boolean existsByUserIdAndMarketAndSymbol(Long userId, String market, String symbol);

    /**
     * Delete a position by user and id.
     *
     * @param userId the user id
     * @param id the position id
     */
    @Modifying
    @Query("DELETE FROM PortfolioPosition p WHERE p.userId = :userId AND p.id = :id")
    void deleteByUserIdAndId(@Param("userId") Long userId, @Param("id") Long id);
}
