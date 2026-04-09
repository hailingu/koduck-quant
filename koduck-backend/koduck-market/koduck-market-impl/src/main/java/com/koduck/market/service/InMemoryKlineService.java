package com.koduck.market.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.koduck.market.dto.KlineDataDto;
import com.koduck.market.entity.KlineData;

/**
 * 内存版 K 线服务实现。
 *
 * <p>用于本地开发阶段兜底 Bean 注入，避免因模块实现未接入导致启动失败。</p>
 */
@Service
public class InMemoryKlineService implements KlineService {

    @Override
    public List<KlineDataDto> getKlineData(
            String market,
            String symbol,
            String timeframe,
            Integer limit,
            Long beforeTime
    ) {
        return List.of();
    }

    @Override
    public Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe) {
        return Optional.empty();
    }

    @Override
    public Optional<BigDecimal> getPreviousClosePrice(String market, String symbol, String timeframe) {
        return Optional.empty();
    }

    @Override
    public Optional<KlineData> getLatestKline(String market, String symbol, String timeframe) {
        return Optional.empty();
    }

    @Override
    public void saveKlineData(List<KlineDataDto> dtos, String market, String symbol, String timeframe) {
        // no-op: 开发阶段的最小实现，不做持久化。
    }

    @Override
    public String normalizeTimeframe(String period, String timeframe) {
        if (timeframe != null && !timeframe.isBlank()) {
            return timeframe.trim().toLowerCase(Locale.ROOT);
        }
        if (period == null || period.isBlank()) {
            return "1d";
        }
        return switch (period.trim().toLowerCase(Locale.ROOT)) {
            case "daily" -> "1d";
            case "weekly" -> "1w";
            case "monthly" -> "1mth";
            default -> "1d";
        };
    }
}
