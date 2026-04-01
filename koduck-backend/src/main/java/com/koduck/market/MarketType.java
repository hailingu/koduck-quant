package com.koduck.market;

/**
 * Enumeration of supported market types.
 * Used to identify different financial markets.
 */
public enum MarketType {
    /**
     * A-Share market (China mainland)
     */
    A_SHARE("a_share", "A股", "CNY"),
    
    /**
     * US stock market
     */
    US_STOCK("us_stock", "美股", "USD"),
    
    /**
     * Hong Kong stock market
     */
    HK_STOCK("hk_stock", "港股", "HKD"),
    
    /**
     * Cryptocurrency market
     */
    CRYPTO("crypto", "加密货币", "USDT"),
    
    /**
     * Futures market
     */
    FUTURES("futures", "期货", "CNY"),
    
    /**
     * Forex market
     */
    FOREX("forex", "外汇", "USD");
    
    private final String code;
    private final String name;
    private final String defaultCurrency;
    
    MarketType(String code, String name, String defaultCurrency) {
        this.code = code;
        this.name = name;
        this.defaultCurrency = defaultCurrency;
    }
    
    public String getCode() {
        return code;
    }
    
    public String getName() {
        return name;
    }
    
    public String getDefaultCurrency() {
        return defaultCurrency;
    }
    
    /**
     * Get MarketType from code string
     * 
     * @param code the market code
     * @return MarketType or null if not found
     */
    public static MarketType fromCode(String code) {
        for (MarketType type : values()) {
            if (type.code.equalsIgnoreCase(code)) {
                return type;
            }
        }
        return null;
    }
    
    /**
     * Check if this market supports pre/post market trading
     */
    public boolean supportsExtendedHours() {
        return this == US_STOCK;
    }
    
    /**
     * Check if this market trades 24/7
     */
    public boolean is24HourMarket() {
        return this == CRYPTO || this == FOREX;
    }
}
