package com.koduck.dto.community;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.koduck.common.constants.DateTimePatternConstants;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 *  DTO
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

    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;
}
