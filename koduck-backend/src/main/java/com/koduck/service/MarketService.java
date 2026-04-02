package com.koduck.service;
import java.util.List;
import java.util.Map;

import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SectorNetworkDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;

/**
 * Market data service interface for stock search, quotes, indices, sectors, and related operations.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public interface MarketService {

    /**
     * Searches stock symbols and names by keyword.
     *
     * @param keyword keyword matching symbol or name
     * @param page page number (1-based)
     * @param size page size
     * @return list of matching stock symbol info
     */
    List<SymbolInfoDto> searchSymbols(String keyword, int page, int size);

    /**
     * Returns hot stocks ordered by trading volume.
     *
     * @param market market code (e.g., "AShare")
     * @param limit maximum number of stocks to return
     * @return list of hot stocks ordered by volume
     */
    List<SymbolInfoDto> getHotStocks(String market, int limit);

    /**
     * Retrieves real-time quote details for a single stock.
     *
     * @param symbol stock symbol
     * @return stock quote details, or {@code null} if not found
     */
    PriceQuoteDto getStockDetail(String symbol);

    /**
     * Retrieves valuation metrics for a single stock.
     *
     * @param symbol stock symbol
     * @return valuation info, or {@code null} if not found
     */
    StockValuationDto getStockValuation(String symbol);

    /**
     * Retrieves industry/sector metadata for a single stock.
     *
     * @param symbol stock symbol
     * @return industry info, or {@code null} if not found
     */
    StockIndustryDto getStockIndustry(String symbol);

    /**
     * Batch-retrieves industry/sector metadata for multiple stocks.
     *
     * @param symbols list of stock symbols
     * @return map keyed by stock symbol to industry info
     */
    Map<String, StockIndustryDto> getStockIndustries(List<String> symbols);

    /**
     * Retrieves a list of major market indices.
     *
     * @return list of market index quotes
     */
    List<MarketIndexDto> getMarketIndices();

    /**
     * Batch-retrieves real-time quotes for multiple stocks.
     *
     * @param symbols list of stock symbols
     * @return quotes matching the input symbols
     */
    List<PriceQuoteDto> getBatchPrices(List<String> symbols);

    /**
     * Retrieves trading statistics for a single stock.
     *
     * @param symbol stock symbol
     * @param market market code
     * @return stock statistics, or {@code null} if not found
     */
    StockStatsDto getStockStats(String symbol, String market);

    /**
     * Retrieves the sector/network relationship data for a given market.
     *
     * @param market market code
     * @return sector network relationship data
     */
    SectorNetworkDto getSectorNetwork(String market);
}
