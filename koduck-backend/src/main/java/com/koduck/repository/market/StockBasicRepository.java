package com.koduck.repository.market;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.market.StockBasic;

/**
 * Repository for stock basic information.
 *
 * @author Koduck Team
 */
@Repository
public interface StockBasicRepository extends JpaRepository<StockBasic, Long> {

    /**
     * Find stock by symbol.
     *
     * @param symbol the symbol
     * @return the optional of stock basic
     */
    Optional<StockBasic> findBySymbol(String symbol);

    /**
     * Find stocks by symbol in list.
     *
     * @param symbols the symbol list
     * @return the list of stock basics
     */
    List<StockBasic> findBySymbolIn(List<String> symbols);

    /**
     * Search stocks by keyword (symbol or name).
     * Uses case-insensitive matching.
     *
     * @param keyword the keyword
     * @param pageable the pageable
     * @return the page of stock basics
     */
    @Query("SELECT s FROM StockBasic s WHERE LOWER(s.symbol) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(s.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "ORDER BY " +
           "CASE WHEN LOWER(s.symbol) = LOWER(:keyword) THEN 0 " +
           "WHEN LOWER(s.symbol) LIKE LOWER(CONCAT(:keyword, '%')) THEN 1 " +
           "WHEN LOWER(s.name) = LOWER(:keyword) THEN 2 " +
           "WHEN LOWER(s.name) LIKE LOWER(CONCAT(:keyword, '%')) THEN 3 " +
           "ELSE 4 END")
    Page<StockBasic> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);

    /**
     * Find stocks by market.
     *
     * @param market the market
     * @return the list of stock basics
     */
    List<StockBasic> findByMarket(String market);

    /**
     * Find stock by symbol and type.
     * Used to distinguish between stocks and indices with same symbol code.
     *
     * @param symbol the symbol
     * @param type the type
     * @return the optional of stock basic
     */
    Optional<StockBasic> findBySymbolAndType(String symbol, String type);

    /**
     * Find stocks by symbol list and type.
     * Used to query indices (type='INDEX') or stocks (type='STOCK').
     *
     * @param symbols the symbol list
     * @param type the type
     * @return the list of stock basics
     */
    List<StockBasic> findBySymbolInAndType(List<String> symbols, String type);
}
