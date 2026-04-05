package com.koduck.infrastructure.config;

import jakarta.validation.constraints.NotBlank;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

import com.koduck.common.constants.HttpHeaderConstants;

import lombok.Data;

/**
 * JSON Web Token (JWT) 处理的配置属性。
 * <p>
 * Bound from application properties with prefix {@code jwt}. Contains
 * secret key, expiration settings, and header/token prefix values used by
 * the security filters.
 * </p>
 *
 * @author GitHub Copilot
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "jwt")
@Validated
public class JwtConfig {

    /**
     * Default access token expiration: 24 hours in milliseconds.
     */
    private static final long DEFAULT_ACCESS_TOKEN_EXPIRATION_MS = 86_400_000L;

    /**
     * Default refresh token expiration: 7 days in milliseconds.
     */
    private static final long DEFAULT_REFRESH_TOKEN_EXPIRATION_MS = 604_800_000L;

    /**
     * Default token prefix (Bearer).
     */
    private static final String DEFAULT_TOKEN_PREFIX = HttpHeaderConstants.BEARER_PREFIX;

    /**
     * Default header name for authorization.
     */
    private static final String DEFAULT_HEADER_NAME = HttpHeaderConstants.AUTHORIZATION;

    /**
     * Secret key used to sign JWT tokens. Should be a secure random string.
     */
    @NotBlank
    private String secret;

    /**
     * Access token lifespan in milliseconds (default 24 hours).
     */
    private Long accessTokenExpiration = DEFAULT_ACCESS_TOKEN_EXPIRATION_MS;

    /**
     * Refresh token lifespan in milliseconds (default 7 days).
     */
    private Long refreshTokenExpiration = DEFAULT_REFRESH_TOKEN_EXPIRATION_MS;

    /**
     * Prefix applied to JWT in the Authorization header (default "Bearer ").
     */
    private String tokenPrefix = DEFAULT_TOKEN_PREFIX;

    /**
     * HTTP header name where the JWT is expected (default "Authorization").
     */
    private String headerName = DEFAULT_HEADER_NAME;
}
