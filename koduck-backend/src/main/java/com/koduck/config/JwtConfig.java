package com.koduck.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * JWT 配置属性
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtConfig {

    private String secret;
    private Long accessTokenExpiration = 86400000L;  // 24小时
    private Long refreshTokenExpiration = 604800000L; // 7天
    private String tokenPrefix = "Bearer ";
    private String headerName = "Authorization";
}
