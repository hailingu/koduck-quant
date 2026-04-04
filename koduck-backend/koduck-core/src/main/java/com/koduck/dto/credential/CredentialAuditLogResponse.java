package com.koduck.dto.credential;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import com.koduck.common.constants.DateTimePatternConstants;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 凭证审计日志响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CredentialAuditLogResponse {

    /** 日志ID. */
    private Long id;

    /** 凭证ID. */
    private Long credentialId;

    /** 操作类型. */
    private String action;

    /** IP地址. */
    private String ipAddress;

    /** 是否成功. */
    private Boolean success;

    /** 错误消息. */
    private String errorMessage;

    /** 创建时间. */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;
}
