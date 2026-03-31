package com.koduck.service.support;

import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SectorNetworkDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.entity.StockBasic;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.StockBasicRepository;
import com.koduck.repository.StockRealtimeRepository;
import com.koduck.util.SymbolUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Shared helper for market service DTO mapping and mock payload construction.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class MarketServiceSupport {

    private static final String STOCK_TYPE = "STOCK";

    private final StockRealtimeRepository stockRealtimeRepository;
    private final StockBasicRepository stockBasicRepository;

    public List<SymbolInfoDto> getHotStocks(String market, int limit) {
        log.debug("Getting hot stocks: market={}, limit={}", market, limit);
        try {
            List<StockRealtime> hotStocks = stockRealtimeRepository.findTopByVolume(limit);
            if (hotStocks.isEmpty()) {
                log.warn("No hot stocks found in database");
                return Collections.emptyList();
            }

            List<String> symbols = hotStocks.stream().map(StockRealtime::getSymbol).toList();
            List<StockBasic> basics = stockBasicRepository.findBySymbolIn(symbols);
            Map<String, StockBasic> basicMap = basics.stream()
                .collect(Collectors.toMap(StockBasic::getSymbol, Function.identity(), (a, b) -> a));

            return hotStocks.stream()
                .map(realtime -> mapRealtimeToSymbolInfoDto(realtime, basicMap.get(realtime.getSymbol()), market))
                .filter(Objects::nonNull)
                .limit(limit)
                .toList();
        } catch (Exception e) {
            log.error("Error getting hot stocks: market={}, limit={}, error={}", market, limit, e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    public SymbolInfoDto mapRealtimeToSymbolInfoDto(StockRealtime realtime, StockBasic basic, String defaultMarket) {
        if (realtime == null) {
            return null;
        }

        String market = defaultMarket;
        String name = realtime.getName();

        if (basic != null) {
            if (basic.getMarket() != null && !basic.getMarket().isBlank()) {
                market = basic.getMarket();
            }
            if (basic.getName() != null && !basic.getName().isBlank()) {
                name = basic.getName();
            }
        }

        return SymbolInfoDto.builder()
            .symbol(realtime.getSymbol())
            .name(name)
            .type(realtime.getType())
            .market(market)
            .price(realtime.getPrice())
            .changePercent(realtime.getChangePercent())
            .volume(realtime.getVolume())
            .amount(realtime.getAmount())
            .build();
    }

    public SymbolInfoDto mapToSymbolInfoDto(StockBasic basic, StockRealtime realtime) {
        String normalizedSymbol = SymbolUtils.normalize(basic.getSymbol());
        if (realtime != null) {
            return SymbolInfoDto.builder()
                .symbol(normalizedSymbol)
                .name(basic.getName())
                .type(realtime.getType())
                .market(basic.getMarket())
                .price(realtime.getPrice())
                .changePercent(realtime.getChangePercent())
                .volume(realtime.getVolume())
                .amount(realtime.getAmount())
                .build();
        }

        return SymbolInfoDto.builder()
            .symbol(normalizedSymbol)
            .name(basic.getName())
            .type(STOCK_TYPE)
            .market(basic.getMarket())
            .build();
    }

    public boolean shouldReplaceSymbol(SymbolInfoDto existing, SymbolInfoDto candidate) {
        if (existing.price() == null && candidate.price() != null) {
            return true;
        }
        if (existing.changePercent() == null && candidate.changePercent() != null) {
            return true;
        }
        if (existing.volume() == null && candidate.volume() != null) {
            return true;
        }
        return existing.amount() == null && candidate.amount() != null;
    }

    public PriceQuoteDto mapToPriceQuoteDto(StockRealtime entity) {
        return PriceQuoteDto.builder()
            .symbol(entity.getSymbol())
            .name(entity.getName())
            .type(entity.getType())
            .price(entity.getPrice())
            .open(entity.getOpenPrice())
            .high(entity.getHigh())
            .low(entity.getLow())
            .prevClose(entity.getPrevClose())
            .volume(entity.getVolume())
            .amount(entity.getAmount())
            .change(entity.getChangeAmount())
            .changePercent(entity.getChangePercent())
            .bidPrice(entity.getBidPrice())
            .bidVolume(entity.getBidVolume())
            .askPrice(entity.getAskPrice())
            .askVolume(entity.getAskVolume())
            .timestamp(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toInstant(ZoneOffset.UTC) : null)
            .build();
    }

    public List<com.koduck.dto.market.KlineDataDto> normalizeKlineData(
            List<com.koduck.dto.market.KlineDataDto> rawData) {
        if (rawData == null || rawData.isEmpty()) {
            return Collections.emptyList();
        }

        List<com.koduck.dto.market.KlineDataDto> normalized = new ArrayList<>();
        for (Object item : rawData) {
            if (item instanceof com.koduck.dto.market.KlineDataDto dto) {
                normalized.add(dto);
                continue;
            }
            if (item instanceof Map<?, ?> map) {
                normalized.add(
                    com.koduck.dto.market.KlineDataDto.builder()
                        .timestamp(toLong(map.get("timestamp")))
                        .open(toBigDecimal(map.get("open")))
                        .high(toBigDecimal(map.get("high")))
                        .low(toBigDecimal(map.get("low")))
                        .close(toBigDecimal(map.get("close")))
                        .volume(toLong(map.get("volume")))
                        .amount(toBigDecimal(map.get("amount")))
                        .build()
                );
            }
        }
        return normalized;
    }

    public BigDecimal calculateChange(BigDecimal price, BigDecimal prevClose) {
        if (price == null || prevClose == null) {
            return null;
        }
        return price.subtract(prevClose);
    }

    public BigDecimal calculateChangePercent(BigDecimal change, BigDecimal prevClose) {
        if (change == null || prevClose == null || BigDecimal.ZERO.compareTo(prevClose) == 0) {
            return null;
        }
        return change.multiply(BigDecimal.valueOf(100)).divide(prevClose, 4, RoundingMode.HALF_UP);
    }

    public MarketIndexDto mapToMarketIndexDto(StockRealtime entity) {
        return MarketIndexDto.builder()
            .symbol(entity.getSymbol())
            .name(entity.getName())
            .type(entity.getType())
            .price(entity.getPrice())
            .change(entity.getChangeAmount())
            .changePercent(entity.getChangePercent())
            .open(entity.getOpenPrice())
            .high(entity.getHigh())
            .low(entity.getLow())
            .prevClose(entity.getPrevClose())
            .volume(entity.getVolume())
            .amount(entity.getAmount())
            .timestamp(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toInstant(ZoneOffset.ofHours(8)) : null)
            .build();
    }

    public MarketIndexDto mapBasicToMarketIndexDto(StockBasic basic) {
        return MarketIndexDto.builder()
            .symbol(basic.getSymbol())
            .name(basic.getName())
            .type(basic.getType())
            .build();
    }

    public StockStatsDto mapToStockStatsDto(StockRealtime entity, String market) {
        return StockStatsDto.builder()
            .symbol(entity.getSymbol())
            .market(market)
            .open(entity.getOpenPrice())
            .high(entity.getHigh())
            .low(entity.getLow())
            .current(entity.getPrice())
            .prevClose(entity.getPrevClose())
            .change(entity.getChangeAmount())
            .changePercent(entity.getChangePercent())
            .volume(entity.getVolume())
            .amount(entity.getAmount())
            .timestamp(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toInstant(ZoneOffset.UTC) : null)
            .build();
    }

    public StockStatsDto mapPriceQuoteToStats(PriceQuoteDto quote, String market) {
        return StockStatsDto.builder()
            .symbol(quote.symbol())
            .market(market)
            .open(quote.open())
            .high(quote.high())
            .low(quote.low())
            .current(quote.price())
            .prevClose(quote.prevClose())
            .change(quote.change())
            .changePercent(quote.changePercent())
            .volume(quote.volume())
            .amount(quote.amount())
            .timestamp(quote.timestamp())
            .build();
    }

    public SectorNetworkDto generateMockSectorNetwork(String positiveLinkType, String negativeLinkType) {
        List<SectorNetworkDto.SectorNode> nodes = List.of(
            SectorNetworkDto.SectorNode.builder().id("1").name("新能源").marketCap(new BigDecimal("8500")).flow(new BigDecimal("67.3")).change(new BigDecimal("3.2")).group(1).build(),
            SectorNetworkDto.SectorNode.builder().id("2").name("锂电池").marketCap(new BigDecimal("4200")).flow(new BigDecimal("34.2")).change(new BigDecimal("2.8")).group(1).build(),
            SectorNetworkDto.SectorNode.builder().id("3").name("光伏").marketCap(new BigDecimal("3800")).flow(new BigDecimal("28.5")).change(new BigDecimal("2.1")).group(1).build(),
            SectorNetworkDto.SectorNode.builder().id("4").name("储能").marketCap(new BigDecimal("2900")).flow(new BigDecimal("15.8")).change(new BigDecimal("1.9")).group(1).build(),
            SectorNetworkDto.SectorNode.builder().id("5").name("银行").marketCap(new BigDecimal("12000")).flow(new BigDecimal("45.2")).change(new BigDecimal("1.2")).group(2).build(),
            SectorNetworkDto.SectorNode.builder().id("6").name("保险").marketCap(new BigDecimal("5600")).flow(new BigDecimal("12.3")).change(new BigDecimal("0.8")).group(2).build(),
            SectorNetworkDto.SectorNode.builder().id("7").name("证券").marketCap(new BigDecimal("4800")).flow(new BigDecimal("-8.5")).change(new BigDecimal("-0.5")).group(2).build(),
            SectorNetworkDto.SectorNode.builder().id("8").name("科技").marketCap(new BigDecimal("9200")).flow(new BigDecimal("-67.5")).change(new BigDecimal("-2.8")).group(3).build(),
            SectorNetworkDto.SectorNode.builder().id("9").name("半导体").marketCap(new BigDecimal("6500")).flow(new BigDecimal("-45.2")).change(new BigDecimal("-2.1")).group(3).build(),
            SectorNetworkDto.SectorNode.builder().id("10").name("软件").marketCap(new BigDecimal("3800")).flow(new BigDecimal("-22.3")).change(new BigDecimal("-1.5")).group(3).build(),
            SectorNetworkDto.SectorNode.builder().id("11").name("医药").marketCap(new BigDecimal("7200")).flow(new BigDecimal("-12.1")).change(new BigDecimal("-0.8")).group(4).build(),
            SectorNetworkDto.SectorNode.builder().id("12").name("医疗器械").marketCap(new BigDecimal("3400")).flow(new BigDecimal("8.5")).change(new BigDecimal("0.5")).group(4).build(),
            SectorNetworkDto.SectorNode.builder().id("13").name("消费").marketCap(new BigDecimal("6800")).flow(new BigDecimal("23.4")).change(new BigDecimal("1.5")).group(5).build(),
            SectorNetworkDto.SectorNode.builder().id("14").name("白酒").marketCap(new BigDecimal("5200")).flow(new BigDecimal("18.9")).change(new BigDecimal("1.2")).group(5).build(),
            SectorNetworkDto.SectorNode.builder().id("15").name("汽车").marketCap(new BigDecimal("5800")).flow(new BigDecimal("15.6")).change(new BigDecimal("0.9")).group(6).build(),
            SectorNetworkDto.SectorNode.builder().id("16").name("军工").marketCap(new BigDecimal("4200")).flow(new BigDecimal("12.8")).change(new BigDecimal("0.7")).group(7).build(),
            SectorNetworkDto.SectorNode.builder().id("17").name("地产").marketCap(new BigDecimal("3600")).flow(new BigDecimal("-45.6")).change(new BigDecimal("-3.2")).group(8).build(),
            SectorNetworkDto.SectorNode.builder().id("18").name("建材").marketCap(new BigDecimal("2800")).flow(new BigDecimal("-18.9")).change(new BigDecimal("-1.8")).group(8).build()
        );

        List<SectorNetworkDto.SectorLink> links = List.of(
            SectorNetworkDto.SectorLink.builder().source("1").target("2").value(new BigDecimal("0.85")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("3").value(new BigDecimal("0.78")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("4").value(new BigDecimal("0.72")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("2").target("3").value(new BigDecimal("0.65")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("6").value(new BigDecimal("0.68")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("7").value(new BigDecimal("0.55")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("8").target("9").value(new BigDecimal("0.82")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("8").target("10").value(new BigDecimal("0.75")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("9").target("10").value(new BigDecimal("0.70")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("11").target("12").value(new BigDecimal("0.62")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("13").target("14").value(new BigDecimal("0.58")).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("8").value(new BigDecimal("-0.65")).type(negativeLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("5").value(new BigDecimal("-0.45")).type(negativeLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("8").value(new BigDecimal("-0.55")).type(negativeLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("2").target("9").value(new BigDecimal("-0.48")).type(negativeLinkType).build()
        );

        return SectorNetworkDto.builder().nodes(nodes).links(links).build();
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException _) {
            return null;
        }
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException _) {
            return null;
        }
    }
}
