package com.koduck.service.support.market;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.koduck.dto.market.KlineDataDto;

/**
 * 外部源原始K线数据的规范化器。
 *
 * @author Koduck Team
 */
@Component
public class KlineDataNormalizer {

    /**
     * 将原始K线数据列表规范化为正确类型的{@link KlineDataDto}实例。
     *
     * @param rawData 原始数据列表（可能包含DTO或未类型化的Map）
     * @return 规范化后的K线DTO列表
     */
    public List<KlineDataDto> normalizeKlineData(List<KlineDataDto> rawData) {
        if (rawData == null || rawData.isEmpty()) {
            return Collections.emptyList();
        }

        List<KlineDataDto> normalized = new ArrayList<>();
        for (Object item : rawData) {
            if (item instanceof KlineDataDto dto) {
                normalized.add(dto);
                continue;
            }
            if (item instanceof Map<?, ?> map) {
                normalized.add(
                    KlineDataDto.builder()
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
