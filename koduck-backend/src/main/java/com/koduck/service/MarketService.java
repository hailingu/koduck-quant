package com.koduck.service;

import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;

import java.util.List;
import java.util.Map;

/**
 * 
 * 
 */
public interface MarketService {
    
    /**
     * 
     *
     * @param keyword 
     * @param page    
     * @param size    
     * @return 
     */
    List<SymbolInfoDto> searchSymbols(String keyword, int page, int size);
    
    /**
     * （）
     *
     * @param symbol 
     * @return 
     */
    PriceQuoteDto getStockDetail(String symbol);

    /**
     * 
     *
     * @param symbol 
     * @return 
     */
    StockValuationDto getStockValuation(String symbol);

    /**
     * 
     *
     * @param symbol 
     * @return 
     */
    StockIndustryDto getStockIndustry(String symbol);

    /**
     * 
     *
     * @param symbols 
     * @return （key  symbol）
     */
    Map<String, StockIndustryDto> getStockIndustries(List<String> symbols);
    
    /**
     * 
     * 
     *
     * @return 
     */
    List<MarketIndexDto> getMarketIndices();
    
    /**
     * 
     *
     * @param symbols 
     * @return 
     */
    List<PriceQuoteDto> getBatchPrices(List<String> symbols);

    /**
     * 
     *
     * @param symbol 
     * @param market 
     * @return 
     */
    StockStatsDto getStockStats(String symbol, String market);
}
