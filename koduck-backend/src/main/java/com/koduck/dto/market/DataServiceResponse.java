package com.koduck.dto.market;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

/**
 * Python Data Service API response wrapper.
 */
public record DataServiceResponse<T>(
    Integer code,
    String message,
    T data,
    @JsonProperty("timestamp")
    Instant timestamp
) {
    
    public boolean isSuccess() {
        return code != null && code == 200;
    }
    
    public static <T> DataServiceResponse<T> empty() {
        return new DataServiceResponse<>(500, "Empty response", null, Instant.now());
    }
}
