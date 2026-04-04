package com.koduck.service.support.market;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.koduck.dto.market.KlineDataDto;

/**
 * Normaliser for raw K-line data coming from external sources.
 *
 * @author Koduck Team
 */
@Component
public class KlineDataNormalizer {

    /**
     * Normalises a list of raw K-line items into properly typed
     * {@link KlineDataDto} instances.
     *
     * @param rawData the raw data list (may contain DTOs or untyped maps)
     * @return a list of normalised K-line DTOs
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
