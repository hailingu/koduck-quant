package com.koduck.dto.market;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Python Data Service API response wrapper.
 *
 * @author Koduck Team
 * @param <T> the type of response data
 * @param code the response code
 * @param message the response message
 * @param data the response data
 * @param timestamp the response timestamp
 */
public record DataServiceResponse<T>(
    Integer code,
    String message,
    T data,
    @JsonProperty("timestamp")
    Instant timestamp
) {

    /**
     * HTTP status code for success.
     */
    private static final int SUCCESS_CODE = 200;

    /**
     * HTTP status code for internal server error.
     */
    private static final int ERROR_CODE = 500;

    /**
     * Check if the response is successful.
     *
     * @return true if success, false otherwise
     */
    public boolean isSuccess() {
        return code != null && code == SUCCESS_CODE;
    }

    /**
     * Create an empty response.
     *
     * @param <T> the type of response data
     * @return an empty DataServiceResponse
     */
    public static <T> DataServiceResponse<T> empty() {
        return new DataServiceResponse<>(ERROR_CODE, "Empty response", null, Instant.now());
    }
}
