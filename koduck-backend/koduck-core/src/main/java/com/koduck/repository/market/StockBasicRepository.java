package com.koduck.repository.market;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.market.entity.StockBasic;

/**
 * 股票基本信息仓库，提供股票基本信息数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface StockBasicRepository extends JpaRepository<StockBasic, Long> {

    /**
     * 根据股票代码查询股票。
     *
     * @param symbol 股票代码
     * @return 股票基本信息
     */
    Optional<StockBasic> findBySymbol(String symbol);

    /**
     * 根据股票代码列表查询股票。
     *
     * @param symbols 股票代码列表
     * @return 股票基本信息列表
     */
    List<StockBasic> findBySymbolIn(List<String> symbols);

    /**
     * 根据关键词搜索股票（股票代码或名称）。
     * 使用不区分大小写的匹配。
     *
     * @param keyword 关键词
     * @param pageable 分页对象
     * @return 股票基本信息分页结果
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
     * 根据市场查询股票。
     *
     * @param market 市场
     * @return 股票基本信息列表
     */
    List<StockBasic> findByMarket(String market);

    /**
     * 根据股票代码和类型查询股票。
     * 用于区分具有相同代码的股票和指数。
     *
     * @param symbol 股票代码
     * @param type 类型
     * @return 股票基本信息
     */
    Optional<StockBasic> findBySymbolAndType(String symbol, String type);

    /**
     * 根据股票代码列表和类型查询股票。
     * 用于查询指数（type='INDEX'）或股票（type='STOCK'）。
     *
     * @param symbols 股票代码列表
     * @param type 类型
     * @return 股票基本信息列表
     */
    List<StockBasic> findBySymbolInAndType(List<String> symbols, String type);
}
