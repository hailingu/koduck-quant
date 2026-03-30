package com.koduck.client;
import com.koduck.config.properties.DataServiceProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import java.util.Collections;
import java.util.List;
/**
 * Client for communicating with the external data-service.
 * Provides methods to trigger realtime data updates for stock symbols.
 */
@Component
@Slf4j
public class DataServiceClient {
    @org.springframework.beans.factory.annotation.Autowired
    private DataServiceProperties dataServiceProperties;
    @org.springframework.beans.factory.annotation.Autowired
    private RestTemplate dataServiceRestTemplate;
    /**
     * Trigger realtime data update for a single stock symbol.
     * This is an asynchronous operation - the method returns immediately
     * after scheduling the update.
     *
     * @param symbol the stock symbol to update (e.g., "601398")
     */
    public void triggerRealtimeUpdate(String symbol) {
        triggerRealtimeUpdate(Collections.singletonList(symbol));
    }
    /**
     * Trigger realtime data update for multiple stock symbols.
     * This is an asynchronous operation - the method returns immediately
     * after scheduling the updates.
     *
     * @param symbols list of stock symbols to update
     */
    public void triggerRealtimeUpdate(List<String> symbols) {
        if (!dataServiceProperties.isEnabled()) {
            log.debug("realtime_update_skipped reason=data_service_disabled");
            return;
        }
        if (symbols == null || symbols.isEmpty()) {
            log.debug("realtime_update_skipped reason=empty_symbols");
            return;
        }
        String url = dataServiceProperties.getBaseUrl() + dataServiceProperties.getRealtimeUpdatePath();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            var requestBody = new java.util.HashMap<String, Object>();
            requestBody.put("symbols", symbols);
            HttpEntity<Object> request = new HttpEntity<>(requestBody, headers);
            dataServiceRestTemplate.postForObject(url, request, Void.class);
            log.info("realtime_update_triggered symbolsCount={} symbols={}",
                    symbols.size(), symbols);
        } catch (Exception e) {
            // Log warning but don't fail the main operation
            // The data will be updated on the next scheduled sync
            log.warn("realtime_update_trigger_failed symbols={} error={}",
                    symbols, e.getMessage());
        }
    }
}
