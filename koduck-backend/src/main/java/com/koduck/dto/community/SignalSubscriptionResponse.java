package com.koduck.dto.community;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import com.koduck.common.constants.DateTimePatternConstants;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Signal subscription response DTO.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalSubscriptionResponse {

    /** The subscription ID. */
    private Long id;

    /** The signal ID. */
    private Long signalId;

    /** The stock symbol. */
    private String symbol;

    /** The signal type. */
    private String signalType;

    /** The subscription reason. */
    private String reason;

    /** The user ID. */
    private Long userId;

    /** The username. */
    private String username;

    /** Whether notification is enabled. */
    private Boolean notifyEnabled;

    /** The creation timestamp. */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;
}
