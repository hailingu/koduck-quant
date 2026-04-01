package com.koduck.market.application;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.mapper.KlineDataDtoMapper;
import com.koduck.service.KlineMinutesService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Implementation of KlineMinutesService.
 * Fetches real-time minute data from Python Data Service.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
public class KlineMinutesServiceImpl implements KlineMinutesService {

    private final RestTemplate dataServiceRestTemplate;
    private final DataServiceProperties properties;
    private final KlineDataDtoMapper klineDataDtoMapper;

    private static final String A_SHARE_BASE_PATH = "/a-share";
    private static final HttpMethod HTTP_GET = HttpMethod.GET;
    private static final ParameterizedTypeReference<DataServiceResponse<List<Map<String, Object>>>>
        KLINE_LIST_RESPONSE_TYPE = new ParameterizedTypeReference<>() {
        };

    public KlineMinutesServiceImpl(@Qualifier("dataServiceRestTemplate") RestTemplate dataServiceRestTemplate,
                                   DataServiceProperties properties,
                                   KlineDataDtoMapper klineDataDtoMapper) {
        this.dataServiceRestTemplate = dataServiceRestTemplate;
        this.properties = properties;
        this.klineDataDtoMapper = klineDataDtoMapper;
    }

    @Override
    public List<KlineDataDto> getMinuteKline(String market, String symbol, String timeframe,
                                             Integer limit, Long beforeTime) {
        if (!properties.isEnabled()) {
            log.warn("Data service is disabled");
            return Collections.emptyList();
        }
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/kline")
                    .queryParam("symbol", symbol)
                    .queryParam("timeframe", timeframe)
                    .queryParam("limit", limit)
                    .toUriString();
            log.debug("Fetching minute kline: {}/{}/{}, limit={}", market, symbol, timeframe, limit);
            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                    dataServiceRestTemplate.exchange(
                            url,
                            Objects.requireNonNull(HTTP_GET, "HTTP_GET must not be null"),
                            null,
                        Objects.requireNonNull(
                                KLINE_LIST_RESPONSE_TYPE,
                                "KLINE_LIST_RESPONSE_TYPE must not be null")
                    );
            DataServiceResponse<List<Map<String, Object>>> body = response.getBody();
            if (body == null || body.data() == null) {
                return Collections.emptyList();
            }
            List<KlineDataDto> klines = body.data().stream()
                    .map(klineDataDtoMapper::fromMap)
                    .toList();
            // Filter by beforeTime if specified
            if (beforeTime != null) {
                klines = klines.stream()
                        .filter(k -> k.timestamp() != null && k.timestamp() < beforeTime)
                        .toList();
            }
            // Reverse to ascending order (oldest to newest) for frontend charting
            List<KlineDataDto> result = new ArrayList<>(klines);
            Collections.reverse(result);
            log.info("Fetched {} minute kline records for {}/{}/{}", result.size(), market, symbol, timeframe);
            return result;
        } catch (RestClientException e) {
            log.error("Failed to fetch minute kline data: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
    @Override
    public boolean isMinuteTimeframe(String timeframe) {
        return timeframe != null && (timeframe.equals("1m") || timeframe.equals("5m") ||
               timeframe.equals("15m") || timeframe.equals("30m") || timeframe.equals("60m"));
    }
}
