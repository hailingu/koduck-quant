package com.koduck.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Token 吊销请求。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenRevocationRequest {

    @JsonProperty("user_id")
    private Long userId;

    @JsonProperty("reason")
    private String reason;
}
