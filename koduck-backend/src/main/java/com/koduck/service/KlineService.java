package com.koduck.service;

import com.koduck.config.CacheConfig;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.entity.KlineData;
import com.koduck.repository.KlineDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for K-line data operations.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KlineService {
    
    private final KlineDataRepository klineDataRepository;
    
    /**
     * Get K-line data for a symbol.
     * Cached for 1 minute.
     */
    @Cacheable(value = CacheConfig.CACHE_KLINE, key = "#market + ':' + #symbol + ':' + #timeframe + ':' + #limit + ':' + #beforeTime")
    public List<KlineDataDto> getKlineData(String market, String symbol, String timeframe, 
                                           Integer limit, Long beforeTime) {
        log.debug("Getting kline data: market={}, symbol={}, timeframe={}, limit={}, beforeTime={}", 
                 market, symbol, timeframe, limit, beforeTime);
        
        Pageable pageable = PageRequest.of(0, limit);
        List<KlineData> data;
        
        if (beforeTime != null) {
            LocalDateTime beforeDateTime = LocalDateTime.ofInstant(
                Instant.ofEpochSecond(beforeTime), ZoneId.systemDefault());
            data = klineDataRepository.findBeforeTime(market, symbol, timeframe, beforeDateTime, pageable);
        } else {
            data = klineDataRepository.findByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
                market, symbol, timeframe, pageable);
        }
        
        return data.stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Get the latest price for a symbol.
     * Cached for 30 seconds.
     */
    @Cacheable(value = CacheConfig.CACHE_PRICE, key = "#market + ':' + #symbol + ':' + #timeframe")
    public Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe) {
        return klineDataRepository
            .findFirstByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(market, symbol, timeframe)
            .map(KlineData::getClosePrice);
    }
    
    /**
     * Save K-line data.
     * Clears cache for the symbol after saving.
     */
    @CacheEvict(value = {CacheConfig.CACHE_KLINE, CacheConfig.CACHE_PRICE}, 
                key = "#market + ':' + #symbol + ':' + #timeframe")
    public void saveKlineData(List<KlineDataDto> dtos, String market, String symbol, String timeframe) {
        List<KlineData> entities = dtos.stream()
            .map(dto -> convertToEntity(dto, market, symbol, timeframe))
            .filter(entity -> !klineDataRepository.existsByMarketAndSymbolAndTimeframeAndKlineTime(
                market, symbol, timeframe, entity.getKlineTime()))
            .collect(Collectors.toList());
        
        if (!entities.isEmpty()) {
            klineDataRepository.saveAll(entities);
            log.info("Saved {} kline records for {}/{}/{}", entities.size(), market, symbol, timeframe);
        }
    }
    
    private KlineDataDto convertToDto(KlineData entity) {
        return KlineDataDto.builder()
            .timestamp(entity.getKlineTime().atZone(ZoneId.systemDefault()).toEpochSecond())
            .open(entity.getOpenPrice())
            .high(entity.getHighPrice())
            .low(entity.getLowPrice())
            .close(entity.getClosePrice())
            .volume(entity.getVolume())
            .amount(entity.getAmount())
            .build();
    }
    
    private KlineData convertToEntity(KlineDataDto dto, String market, String symbol, String timeframe) {
        LocalDateTime klineTime = LocalDateTime.ofInstant(
            Instant.ofEpochSecond(dto.timestamp()), ZoneId.systemDefault());
        
        return KlineData.builder()
            .market(market)
            .symbol(symbol)
            .timeframe(timeframe)
            .klineTime(klineTime)
            .openPrice(dto.open())
            .highPrice(dto.high())
            .lowPrice(dto.low())
            .closePrice(dto.close())
            .volume(dto.volume())
            .amount(dto.amount())
            .build();
    }
}
