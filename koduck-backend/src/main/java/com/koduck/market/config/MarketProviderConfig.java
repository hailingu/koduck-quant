package com.koduck.market.config;

import com.koduck.market.provider.ProviderFactory;
import com.koduck.service.market.AKShareDataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for market data providers.
 * Registers all provider implementations on application startup.
 */
@Configuration
public class MarketProviderConfig {
    
    private static final Logger log = LoggerFactory.getLogger(MarketProviderConfig.class);
    
    @Bean
    public ProviderFactory providerFactory() {
        return new ProviderFactory();
    }
    
    @Bean
    public ApplicationRunner registerProviders(ProviderFactory providerFactory, 
                                               AKShareDataProvider akShareDataProvider) {
        return (ApplicationArguments args) -> {
            log.info("Registering market data providers...");
            
            // Register A-Share provider
            providerFactory.registerProvider(akShareDataProvider);
            log.info("Registered provider: {} for market {}", 
                    akShareDataProvider.getProviderName(), 
                    akShareDataProvider.getMarketType());
            
            // Log registered markets
            log.info("Supported markets: {}", providerFactory.getSupportedMarkets());
        };
    }
}
