package com.koduck.service.impl.market;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.dto.market.SectorNetFlowDto;
import com.koduck.dto.market.SectorNetFlowItemDto;
import com.koduck.entity.market.MarketSectorNetFlow;
import com.koduck.repository.market.MarketSectorNetFlowRepository;
import com.koduck.service.MarketSectorNetFlowService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MarketSectorNetFlowServiceImpl implements MarketSectorNetFlowService {
    private final MarketSectorNetFlowRepository repository;
    @Override
    @Transactional(readOnly = true)
    public SectorNetFlowDto getLatest(String market, String indicator, int limitPerType) {
        return repository.findFirstByMarketAndIndicatorOrderByTradeDateDesc(market, indicator)
                .map(row -> buildResponse(
                        repository.findByMarketAndIndicatorAndTradeDate(market, indicator, row.getTradeDate()),
                        limitPerType
                ))
                .orElse(null);
    }
    @Override
    @Transactional(readOnly = true)
    public SectorNetFlowDto getByTradeDate(String market, String indicator, LocalDate tradeDate, int limitPerType) {
        List<MarketSectorNetFlow> rows = repository.findByMarketAndIndicatorAndTradeDate(market, indicator, tradeDate);
        if (rows == null || rows.isEmpty()) {
            return null;
        }
        return buildResponse(rows, limitPerType);
    }
    private SectorNetFlowDto buildResponse(List<MarketSectorNetFlow> rows, int limitPerType) {
        Map<String, List<MarketSectorNetFlow>> byType = rows.stream()
                .collect(Collectors.groupingBy(row -> normalizeType(row.getSectorType())));
        List<SectorNetFlowItemDto> industry = toItems(byType.getOrDefault("industry", List.of()), limitPerType);
        List<SectorNetFlowItemDto> concept = toItems(byType.getOrDefault("concept", List.of()), limitPerType);
        List<SectorNetFlowItemDto> region = toItems(byType.getOrDefault("region", List.of()), limitPerType);
        BigDecimal totalMainForce = rows.stream()
                .map(MarketSectorNetFlow::getMainForceNet)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalRetail = rows.stream()
                .map(MarketSectorNetFlow::getRetailNet)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        MarketSectorNetFlow first = rows.get(0);
        return new SectorNetFlowDto(
                first.getMarket(),
                first.getIndicator(),
                first.getTradeDate(),
                totalMainForce,
                totalRetail,
                industry,
                concept,
                region,
                first.getSource(),
                first.getQuality()
        );
    }
    private List<SectorNetFlowItemDto> toItems(List<MarketSectorNetFlow> rows, int limitPerType) {
        return rows.stream()
                .sorted(Comparator.comparing(MarketSectorNetFlowServiceImpl::absMainForceNet).reversed())
                .limit(Math.max(limitPerType, 1))
                .map(this::toItemDto)
                .toList();
    }
    private SectorNetFlowItemDto toItemDto(MarketSectorNetFlow entity) {
        return new SectorNetFlowItemDto(
                normalizeType(entity.getSectorType()),
                entity.getSectorName(),
                entity.getMainForceNet(),
                entity.getRetailNet(),
                entity.getSuperBigNet(),
                entity.getBigNet(),
                entity.getMediumNet(),
                entity.getSmallNet(),
                entity.getChangePct(),
                entity.getSnapshotTime()
        );
    }
    private static BigDecimal absMainForceNet(MarketSectorNetFlow row) {
        BigDecimal value = row.getMainForceNet();
        return value == null ? BigDecimal.ZERO : value.abs();
    }
    private static String normalizeType(String sectorType) {
        if (sectorType == null) {
            return "industry";
        }
        String normalized = sectorType.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "industry", "concept", "region" -> normalized;
            default -> normalized;
        };
    }
}
