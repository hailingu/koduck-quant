package com.koduck.dto.credential;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 *  DTO（，）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CredentialDetailResponse {

    private Long id;
    private String name;
    private String type;
    private String provider;
    private String environment;
    private Boolean isActive;

    //  API Key（）
    private String apiKey;

    //  API Secret（）
    private String apiSecret;

    private Map<String, Object> additionalConfig;

    private String lastVerifiedStatus;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime lastVerifiedAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
}
