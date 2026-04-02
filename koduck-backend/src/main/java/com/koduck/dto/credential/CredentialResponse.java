package com.koduck.dto.credential;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import com.koduck.common.constants.DateTimePatternConstants;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 凭证响应 DTO（列表视图）。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class CredentialResponse {

    /** 凭证ID. */
    private Long id;

    /** 凭证名称. */
    private String name;

    /** 凭证类型. */
    private String type;

    /** API Key（脱敏）. */
    private String apiKeyMasked;

    /** 是否启用. */
    private Boolean enabled;

    /** 创建时间. */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;
}
