package com.koduck.config;

import com.koduck.common.constants.HttpHeaderConstants;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

/**
 * Configuration properties for JSON Web Token (JWT) handling.
 * <p>
 * Bound from application properties with prefix {@code jwt}. Contains
 * secret key, expiration settings, and header/token prefix values used by
 * the security filters.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "jwt")
@Validated
public class JwtConfig {

    private static final long DEFAULT_ACCESS_TOKEN_EXPIRATION_MS = 86_400_000L;
    private static final long DEFAULT_REFRESH_TOKEN_EXPIRATION_MS = 604_800_000L;
    private static final String DEFAULT_TOKEN_PREFIX = HttpHeaderConstants.BEARER_PREFIX;
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
