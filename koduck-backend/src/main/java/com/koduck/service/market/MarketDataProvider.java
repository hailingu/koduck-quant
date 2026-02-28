package com.koduck.service.market;

import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SymbolInfoDto;
import java.util.List;

/**
 * Market data provider interface.
 * Defines contracts for fetching market data from various sources.
 */
public interface MarketDataProvider {
    
    /**
     * Get the market type this provider supports.
     * 
     * @return MarketType enum value
     */
    MarketType getMarketType();
    
    /**
     * Search for symbols by keyword.
     * 
     * @param keyword Search keyword (symbol or name)
     * @param limit Maximum number of results
     * @return List of matching symbols
     */
    List<SymbolInfoDto> searchSymbols(String keyword, int limit);
    
    /**
     * Get real-time price for a single symbol.
     * 
     * @param symbol Stock symbol (e.g., "002326")
     * @return Price quote or null if not found
     */
    PriceQuoteDto getPrice(String symbol);
    
    /**
     * Get real-time prices for multiple symbols.
     * 
     * @param symbols List of stock symbols
     * @return List of price quotes for found symbols
     */
    List<PriceQuoteDto> getBatchPrices(List<String> symbols);
    
    /**
     * Get hot symbols sorted by trading volume/amount.
     * 
     * @param limit Number of hot symbols to return
     * @return List of hot symbols
     */
    List<SymbolInfoDto> getHotSymbols(int limit);
    
    /**
     * Market types supported by the system.
     */
    enum MarketType {
        ASHARE("AShare", "A股"),
        HSHARE("HShare", "港股"),
        US_STOCK("USStock", "美股"),
        CRYPTO("Crypto", "加密货币"),
        FOREX("Forex", "外汇"),
        FUTURES("Futures", "期货");
        
        private final String code;
        private final String name;
        
        MarketType(String code, String name) {
            this.code = code;
            this.name = name;
        }
        
        public String getCode() {
            return code;
        }
        
        public String getName() {
            return name;
        }
    }
}
