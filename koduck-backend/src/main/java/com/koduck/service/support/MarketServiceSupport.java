package com.koduck.service.support;

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

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

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

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 市场服务DTO映射和模拟数据构建的共享助手类。
 *
 * @author Koduck Team
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class MarketServiceSupport {

    /** 股票类型。 */
    private static final String STOCK_TYPE = "STOCK";
    /** 除法精度。 */
    private static final int DIVIDE_SCALE = 4;
    /** 板块节点分组1。 */
    private static final int SECTOR_NODE_GROUP_1 = 1;
    /** 板块节点分组2。 */
    private static final int SECTOR_NODE_GROUP_2 = 2;
    /** 板块节点分组3。 */
    private static final int SECTOR_NODE_GROUP_3 = 3;
    /** 板块节点分组4。 */
    private static final int SECTOR_NODE_GROUP_4 = 4;
    /** 板块节点分组5。 */
    private static final int SECTOR_NODE_GROUP_5 = 5;
    /** 板块节点分组6。 */
    private static final int SECTOR_NODE_GROUP_6 = 6;
    /** 板块节点分组7。 */
    private static final int SECTOR_NODE_GROUP_7 = 7;
    /** 板块节点分组8。 */
    private static final int SECTOR_NODE_GROUP_8 = 8;
    /** 市值8500。 */
    private static final BigDecimal MARKET_CAP_8500 = new BigDecimal("8500");
    /** 市值4200。 */
    private static final BigDecimal MARKET_CAP_4200 = new BigDecimal("4200");
    /** 市值3800。 */
    private static final BigDecimal MARKET_CAP_3800 = new BigDecimal("3800");
    /** 市值2900。 */
    private static final BigDecimal MARKET_CAP_2900 = new BigDecimal("2900");
    /** 市值12000。 */
    private static final BigDecimal MARKET_CAP_12000 = new BigDecimal("12000");
    /** 市值5600。 */
    private static final BigDecimal MARKET_CAP_5600 = new BigDecimal("5600");
    /** 市值4800。 */
    private static final BigDecimal MARKET_CAP_4800 = new BigDecimal("4800");
    /** 市值9200。 */
    private static final BigDecimal MARKET_CAP_9200 = new BigDecimal("9200");
    /** 市值6500。 */
    private static final BigDecimal MARKET_CAP_6500 = new BigDecimal("6500");
    /** 市值7200。 */
    private static final BigDecimal MARKET_CAP_7200 = new BigDecimal("7200");
    /** 市值6800。 */
    private static final BigDecimal MARKET_CAP_6800 = new BigDecimal("6800");
    /** 市值5200。 */
    private static final BigDecimal MARKET_CAP_5200 = new BigDecimal("5200");
    /** 市值5800。 */
    private static final BigDecimal MARKET_CAP_5800 = new BigDecimal("5800");
    /** 市值3600。 */
    private static final BigDecimal MARKET_CAP_3600 = new BigDecimal("3600");
    /** 市值3400。 */
    private static final BigDecimal MARKET_CAP_3400 = new BigDecimal("3400");
    /** 市值2800。 */
    private static final BigDecimal MARKET_CAP_2800 = new BigDecimal("2800");
    /** 资金流向67.3。 */
    private static final BigDecimal FLOW_67_3 = new BigDecimal("67.3");
    /** 资金流向34.2。 */
    private static final BigDecimal FLOW_34_2 = new BigDecimal("34.2");
    /** 资金流向28.5。 */
    private static final BigDecimal FLOW_28_5 = new BigDecimal("28.5");
    /** 资金流向15.8。 */
    private static final BigDecimal FLOW_15_8 = new BigDecimal("15.8");
    /** 资金流向45.2。 */
    private static final BigDecimal FLOW_45_2 = new BigDecimal("45.2");
    /** 资金流向12.3。 */
    private static final BigDecimal FLOW_12_3 = new BigDecimal("12.3");
    /** 资金流向-8.5。 */
    private static final BigDecimal FLOW_NEG_8_5 = new BigDecimal("-8.5");
    /** 资金流向-67.5。 */
    private static final BigDecimal FLOW_NEG_67_5 = new BigDecimal("-67.5");
    /** 资金流向-45.2。 */
    private static final BigDecimal FLOW_NEG_45_2 = new BigDecimal("-45.2");
    /** 资金流向-22.3。 */
    private static final BigDecimal FLOW_NEG_22_3 = new BigDecimal("-22.3");
    /** 资金流向-12.1。 */
    private static final BigDecimal FLOW_NEG_12_1 = new BigDecimal("-12.1");
    /** 资金流向8.5。 */
    private static final BigDecimal FLOW_8_5 = new BigDecimal("8.5");
    /** 资金流向23.4。 */
    private static final BigDecimal FLOW_23_4 = new BigDecimal("23.4");
    /** 资金流向18.9。 */
    private static final BigDecimal FLOW_18_9 = new BigDecimal("18.9");
    /** 资金流向15.6。 */
    private static final BigDecimal FLOW_15_6 = new BigDecimal("15.6");
    /** 资金流向12.8。 */
    private static final BigDecimal FLOW_12_8 = new BigDecimal("12.8");
    /** 资金流向-45.6。 */
    private static final BigDecimal FLOW_NEG_45_6 = new BigDecimal("-45.6");
    /** 资金流向-18.9。 */
    private static final BigDecimal FLOW_NEG_18_9 = new BigDecimal("-18.9");
    /** 涨跌幅3.2。 */
    private static final BigDecimal CHANGE_3_2 = new BigDecimal("3.2");
    /** 涨跌幅2.8。 */
    private static final BigDecimal CHANGE_2_8 = new BigDecimal("2.8");
    /** 涨跌幅2.1。 */
    private static final BigDecimal CHANGE_2_1 = new BigDecimal("2.1");
    /** 涨跌幅1.9。 */
    private static final BigDecimal CHANGE_1_9 = new BigDecimal("1.9");
    /** 涨跌幅1.2。 */
    private static final BigDecimal CHANGE_1_2 = new BigDecimal("1.2");
    /** 涨跌幅0.8。 */
    private static final BigDecimal CHANGE_0_8 = new BigDecimal("0.8");
    /** 涨跌幅-0.5。 */
    private static final BigDecimal CHANGE_NEG_0_5 = new BigDecimal("-0.5");
    /** 涨跌幅-2.8。 */
    private static final BigDecimal CHANGE_NEG_2_8 = new BigDecimal("-2.8");
    /** 涨跌幅-2.1。 */
    private static final BigDecimal CHANGE_NEG_2_1 = new BigDecimal("-2.1");
    /** 涨跌幅-1.5。 */
    private static final BigDecimal CHANGE_NEG_1_5 = new BigDecimal("-1.5");
    /** 涨跌幅-0.8。 */
    private static final BigDecimal CHANGE_NEG_0_8 = new BigDecimal("-0.8");
    /** 涨跌幅0.5。 */
    private static final BigDecimal CHANGE_0_5 = new BigDecimal("0.5");
    /** 涨跌幅1.5。 */
    private static final BigDecimal CHANGE_1_5 = new BigDecimal("1.5");
    /** 涨跌幅0.9。 */
    private static final BigDecimal CHANGE_0_9 = new BigDecimal("0.9");
    /** 涨跌幅0.7。 */
    private static final BigDecimal CHANGE_0_7 = new BigDecimal("0.7");
    /** 涨跌幅-3.2。 */
    private static final BigDecimal CHANGE_NEG_3_2 = new BigDecimal("-3.2");
    /** 涨跌幅-1.8。 */
    private static final BigDecimal CHANGE_NEG_1_8 = new BigDecimal("-1.8");
    /** 关联值0.85。 */
    private static final BigDecimal LINK_VALUE_0_85 = new BigDecimal("0.85");
    /** 关联值0.78。 */
    private static final BigDecimal LINK_VALUE_0_78 = new BigDecimal("0.78");
    /** 关联值0.72。 */
    private static final BigDecimal LINK_VALUE_0_72 = new BigDecimal("0.72");
    /** 关联值0.65。 */
    private static final BigDecimal LINK_VALUE_0_65 = new BigDecimal("0.65");
    /** 关联值0.68。 */
    private static final BigDecimal LINK_VALUE_0_68 = new BigDecimal("0.68");
    /** 关联值0.55。 */
    private static final BigDecimal LINK_VALUE_0_55 = new BigDecimal("0.55");
    /** 关联值0.82。 */
    private static final BigDecimal LINK_VALUE_0_82 = new BigDecimal("0.82");
    /** 关联值0.75。 */
    private static final BigDecimal LINK_VALUE_0_75 = new BigDecimal("0.75");
    /** 关联值0.70。 */
    private static final BigDecimal LINK_VALUE_0_70 = new BigDecimal("0.70");
    /** 关联值0.62。 */
    private static final BigDecimal LINK_VALUE_0_62 = new BigDecimal("0.62");
    /** 关联值0.58。 */
    private static final BigDecimal LINK_VALUE_0_58 = new BigDecimal("0.58");
    /** 关联值-0.65。 */
    private static final BigDecimal LINK_VALUE_NEG_0_65 = new BigDecimal("-0.65");
    /** 关联值-0.45。 */
    private static final BigDecimal LINK_VALUE_NEG_0_45 = new BigDecimal("-0.45");
    /** 关联值-0.55。 */
    private static final BigDecimal LINK_VALUE_NEG_0_55 = new BigDecimal("-0.55");
    /** 关联值-0.48。 */
    private static final BigDecimal LINK_VALUE_NEG_0_48 = new BigDecimal("-0.48");
    /** 百分比乘数。 */
    private static final int PERCENTAGE_MULTIPLIER = 100;
    /** UTC偏移小时数。 */
    private static final int UTC_OFFSET_HOURS = 8;

    /** 股票实时数据仓库。 */
    private final StockRealtimeRepository stockRealtimeRepository;
    /** 股票基础信息仓库。 */
    private final StockBasicRepository stockBasicRepository;

    /**
     * 获取热门股票。
     *
     * @param market 市场
     * @param limit 限制数量
     * @return 股票信息列表
     */
    public List<SymbolInfoDto> getHotStocks(String market, int limit) {
        log.debug("Getting hot stocks: market={}, limit={}", market, limit);
        try {
            List<StockRealtime> hotStocks = stockRealtimeRepository.findTopByVolume(PageRequest.of(0, limit));
            if (hotStocks.isEmpty()) {
                log.warn("No hot stocks found in database");
                return Collections.emptyList();
            }

            List<String> symbols = hotStocks.stream().map(StockRealtime::getSymbol).toList();
            List<StockBasic> basics = stockBasicRepository.findBySymbolIn(symbols);
            Map<String, StockBasic> basicMap = basics.stream()
                .collect(Collectors.toMap(StockBasic::getSymbol, Function.identity(), (a, b) -> a));

            return hotStocks.stream()
                .map(realtime -> mapRealtimeToSymbolInfoDto(realtime,
                    basicMap.get(realtime.getSymbol()), market))
                .filter(Objects::nonNull)
                .limit(limit)
                .toList();
        }
        catch (Exception e) {
            log.error("Error getting hot stocks: market={}, limit={}, error={}",
                market, limit, e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    /**
     * 将实时股票数据映射为SymbolInfoDto。
     *
     * @param realtime 实时数据
     * @param basic 基本信息
     * @param defaultMarket 默认市场
     * @return 股票信息DTO
     */
    public SymbolInfoDto mapRealtimeToSymbolInfoDto(StockRealtime realtime,
        StockBasic basic, String defaultMarket) {
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

    /**
     * 映射为SymbolInfoDto。
     *
     * @param basic 基本信息
     * @param realtime 实时数据
     * @return 股票信息DTO
     */
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

    /**
     * 判断是否应该替换现有股票信息。
     *
     * @param existing 现有股票信息
     * @param candidate 候选股票信息
     * @return 是否应该替换
     */
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

    /**
     * 映射为PriceQuoteDto。
     *
     * @param entity 实时数据实体
     * @return 价格报价DTO
     */
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
            .timestamp(entity.getUpdatedAt() != null
                ? entity.getUpdatedAt().toInstant(ZoneOffset.UTC) : null)
            .build();
    }

    /**
     * 规范化K线数据。
     *
     * @param rawData 原始数据
     * @return 规范化后的数据
     */
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

    /**
     * 计算涨跌幅。
     *
     * @param price 当前价格
     * @param prevClose 前收盘价
     * @return 涨跌幅
     */
    public BigDecimal calculateChange(BigDecimal price, BigDecimal prevClose) {
        if (price == null || prevClose == null) {
            return null;
        }
        return price.subtract(prevClose);
    }

    /**
     * 计算涨跌百分比。
     *
     * @param change 涨跌额
     * @param prevClose 前收盘价
     * @return 涨跌百分比
     */
    public BigDecimal calculateChangePercent(BigDecimal change, BigDecimal prevClose) {
        if (change == null || prevClose == null
            || BigDecimal.ZERO.compareTo(prevClose) == 0) {
            return null;
        }
        return change.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER)).divide(prevClose,
            DIVIDE_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * 映射为MarketIndexDto。
     *
     * @param entity 实时数据实体
     * @return 市场指数DTO
     */
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
            .timestamp(entity.getUpdatedAt() != null
                ? entity.getUpdatedAt().toInstant(ZoneOffset.ofHours(UTC_OFFSET_HOURS)) : null)
            .build();
    }

    /**
     * 将基本信息映射为MarketIndexDto。
     *
     * @param basic 基本信息
     * @return 市场指数DTO
     */
    public MarketIndexDto mapBasicToMarketIndexDto(StockBasic basic) {
        return MarketIndexDto.builder()
            .symbol(basic.getSymbol())
            .name(basic.getName())
            .type(basic.getType())
            .build();
    }

    /**
     * 映射为StockStatsDto。
     *
     * @param entity 实时数据实体
     * @param market 市场
     * @return 股票统计DTO
     */
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
            .timestamp(entity.getUpdatedAt() != null
                ? entity.getUpdatedAt().toInstant(ZoneOffset.UTC) : null)
            .build();
    }

    /**
     * 将价格报价映射为统计信息。
     *
     * @param quote 价格报价
     * @param market 市场
     * @return 股票统计DTO
     */
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

    /**
     * 生成模拟板块网络数据。
     *
     * @param positiveLinkType 正相关链接类型
     * @param negativeLinkType 负相关链接类型
     * @return 板块网络DTO
     */
    public SectorNetworkDto generateMockSectorNetwork(String positiveLinkType,
        String negativeLinkType) {
        return SectorNetworkDto.builder()
            .nodes(buildMockSectorNodes())
            .links(buildMockSectorLinks(positiveLinkType, negativeLinkType))
            .build();
    }

    /**
     * 构建模拟板块节点列表。
     *
     * @return 板块节点列表
     */
    private List<SectorNetworkDto.SectorNode> buildMockSectorNodes() {
        return List.of(
            SectorNetworkDto.SectorNode.builder().id("1").name("新能源")
                .marketCap(MARKET_CAP_8500).flow(FLOW_67_3).change(CHANGE_3_2)
                .group(SECTOR_NODE_GROUP_1).build(),
            SectorNetworkDto.SectorNode.builder().id("2").name("锂电池")
                .marketCap(MARKET_CAP_4200).flow(FLOW_34_2).change(CHANGE_2_8)
                .group(SECTOR_NODE_GROUP_1).build(),
            SectorNetworkDto.SectorNode.builder().id("3").name("光伏")
                .marketCap(MARKET_CAP_3800).flow(FLOW_28_5).change(CHANGE_2_1)
                .group(SECTOR_NODE_GROUP_1).build(),
            SectorNetworkDto.SectorNode.builder().id("4").name("储能")
                .marketCap(MARKET_CAP_2900).flow(FLOW_15_8).change(CHANGE_1_9)
                .group(SECTOR_NODE_GROUP_1).build(),
            SectorNetworkDto.SectorNode.builder().id("5").name("银行")
                .marketCap(MARKET_CAP_12000).flow(FLOW_45_2).change(CHANGE_1_2)
                .group(SECTOR_NODE_GROUP_2).build(),
            SectorNetworkDto.SectorNode.builder().id("6").name("保险")
                .marketCap(MARKET_CAP_5600).flow(FLOW_12_3).change(CHANGE_0_8)
                .group(SECTOR_NODE_GROUP_2).build(),
            SectorNetworkDto.SectorNode.builder().id("7").name("证券")
                .marketCap(MARKET_CAP_4800).flow(FLOW_NEG_8_5).change(CHANGE_NEG_0_5)
                .group(SECTOR_NODE_GROUP_2).build(),
            SectorNetworkDto.SectorNode.builder().id("8").name("科技")
                .marketCap(MARKET_CAP_9200).flow(FLOW_NEG_67_5).change(CHANGE_NEG_2_8)
                .group(SECTOR_NODE_GROUP_3).build(),
            SectorNetworkDto.SectorNode.builder().id("9").name("半导体")
                .marketCap(MARKET_CAP_6500).flow(FLOW_NEG_45_2).change(CHANGE_NEG_2_1)
                .group(SECTOR_NODE_GROUP_3).build(),
            SectorNetworkDto.SectorNode.builder().id("10").name("软件")
                .marketCap(MARKET_CAP_3800).flow(FLOW_NEG_22_3).change(CHANGE_NEG_1_5)
                .group(SECTOR_NODE_GROUP_3).build(),
            SectorNetworkDto.SectorNode.builder().id("11").name("医药")
                .marketCap(MARKET_CAP_7200).flow(FLOW_NEG_12_1).change(CHANGE_NEG_0_8)
                .group(SECTOR_NODE_GROUP_4).build(),
            SectorNetworkDto.SectorNode.builder().id("12").name("医疗器械")
                .marketCap(MARKET_CAP_3400).flow(FLOW_8_5).change(CHANGE_0_5)
                .group(SECTOR_NODE_GROUP_4).build(),
            SectorNetworkDto.SectorNode.builder().id("13").name("消费")
                .marketCap(MARKET_CAP_6800).flow(FLOW_23_4).change(CHANGE_1_5)
                .group(SECTOR_NODE_GROUP_5).build(),
            SectorNetworkDto.SectorNode.builder().id("14").name("白酒")
                .marketCap(MARKET_CAP_5200).flow(FLOW_18_9).change(CHANGE_1_2)
                .group(SECTOR_NODE_GROUP_5).build(),
            SectorNetworkDto.SectorNode.builder().id("15").name("汽车")
                .marketCap(MARKET_CAP_5800).flow(FLOW_15_6).change(CHANGE_0_9)
                .group(SECTOR_NODE_GROUP_6).build(),
            SectorNetworkDto.SectorNode.builder().id("16").name("军工")
                .marketCap(MARKET_CAP_4200).flow(FLOW_12_8).change(CHANGE_0_7)
                .group(SECTOR_NODE_GROUP_7).build(),
            SectorNetworkDto.SectorNode.builder().id("17").name("地产")
                .marketCap(MARKET_CAP_3600).flow(FLOW_NEG_45_6).change(CHANGE_NEG_3_2)
                .group(SECTOR_NODE_GROUP_8).build(),
            SectorNetworkDto.SectorNode.builder().id("18").name("建材")
                .marketCap(MARKET_CAP_2800).flow(FLOW_NEG_18_9).change(CHANGE_NEG_1_8)
                .group(SECTOR_NODE_GROUP_8).build()
        );
    }

    /**
     * 构建模拟板块链接列表。
     *
     * @param positiveLinkType 正相关链接类型
     * @param negativeLinkType 负相关链接类型
     * @return 板块链接列表
     */
    private List<SectorNetworkDto.SectorLink> buildMockSectorLinks(String positiveLinkType,
        String negativeLinkType) {
        return List.of(
            SectorNetworkDto.SectorLink.builder().source("1").target("2")
                .value(LINK_VALUE_0_85).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("3")
                .value(LINK_VALUE_0_78).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("4")
                .value(LINK_VALUE_0_72).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("2").target("3")
                .value(LINK_VALUE_0_65).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("6")
                .value(LINK_VALUE_0_68).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("7")
                .value(LINK_VALUE_0_55).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("8").target("9")
                .value(LINK_VALUE_0_82).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("8").target("10")
                .value(LINK_VALUE_0_75).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("9").target("10")
                .value(LINK_VALUE_0_70).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("11").target("12")
                .value(LINK_VALUE_0_62).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("13").target("14")
                .value(LINK_VALUE_0_58).type(positiveLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("8")
                .value(LINK_VALUE_NEG_0_65).type(negativeLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("5")
                .value(LINK_VALUE_NEG_0_45).type(negativeLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("8")
                .value(LINK_VALUE_NEG_0_55).type(negativeLinkType).build(),
            SectorNetworkDto.SectorLink.builder().source("2").target("9")
                .value(LINK_VALUE_NEG_0_48).type(negativeLinkType).build()
        );
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
        }
        catch (NumberFormatException e) {
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
        }
        catch (NumberFormatException e) {
            return null;
        }
    }
}
