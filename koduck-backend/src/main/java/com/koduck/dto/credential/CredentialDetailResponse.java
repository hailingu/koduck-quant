package com.koduck.dto.credential;
import java.time.LocalDateTime;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonFormat;

import com.koduck.common.constants.DateTimePatternConstants;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 凭证详情响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class CredentialDetailResponse {

    /** 凭证ID. */
    private Long id;

    /** 凭证名称. */
    private String name;

    /** 凭证类型. */
    private String type;

    /** API Key. */
    private String apiKey;

    /** 额外配置. */
    private Map<String, Object> extraConfig;

    /** 是否启用. */
    private Boolean enabled;

    /** 创建时间. */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;

    /** 更新时间. */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime updatedAt;
}
