package com.koduck.dto.community;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 信号订阅响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalSubscriptionResponse {

    private Long id;
    private Long signalId;
    private String symbol;
    private String signalType;
    private String reason;
    private Long userId;
    private String username;
    private Boolean notifyEnabled;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
}
