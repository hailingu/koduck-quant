package com.koduck.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.StockTickHistory;

@Repository
public interface StockTickHistoryRepository extends JpaRepository<StockTickHistory, Long> {

    List<StockTickHistory> findBySymbolOrderByTickTimeDescIdDesc(String symbol, Pageable pageable);

    List<StockTickHistory> findBySymbolAndIdGreaterThanOrderByIdAsc(String symbol, Long lastId);
}

