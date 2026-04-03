package com.koduck.util;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Component;

import com.koduck.config.JwtConfig;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import lombok.extern.slf4j.Slf4j;

/**
 * JWT utility for token generation, parsing, and validation.
 *
 * @author GitHub Copilot
 */
@Slf4j
@Component
public class JwtUtil {

    /**
     * JWT configuration properties.
     */
    private final JwtConfig jwtConfig;

    /**
     * Creates the JWT helper.
     *
     * @param jwtConfig JWT configuration properties
     */
    public JwtUtil(final JwtConfig jwtConfig) {
        this.jwtConfig = Objects.requireNonNull(jwtConfig, "jwtConfig must not be null");
    }

    /**
     * Returns the signing key derived from the configured secret.
     *
     * @return signing key
     */
    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtConfig.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Generates an access token.
     *
     * @param userId user id
     * @param username username
     * @param email email
     * @return signed access token
     */
    public String generateAccessToken(final Long userId, final String username, final String email) {
        final Map<String, Object> claims = new HashMap<>();
        final Instant issuedAt = Instant.now();
        claims.put("userId", userId);
        claims.put("username", username);
        claims.put("email", email);
        claims.put("type", "access");
        return Jwts.builder()
                .claims(claims)
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(issuedAt.plusMillis(jwtConfig.getAccessTokenExpiration())))
                .id(UUID.randomUUID().toString())
                .signWith(getSigningKey(), Jwts.SIG.HS256)
                .compact();
    }

    /**
     * Generates a refresh token.
     *
     * @param userId user id
     * @return signed refresh token
     */
    public String generateRefreshToken(final Long userId) {
        final Map<String, Object> claims = new HashMap<>();
        final Instant issuedAt = Instant.now();
        claims.put("userId", userId);
        claims.put("type", "refresh");
        return Jwts.builder()
                .claims(claims)
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(issuedAt.plusMillis(jwtConfig.getRefreshTokenExpiration())))
                .id(UUID.randomUUID().toString())
                .signWith(getSigningKey(), Jwts.SIG.HS256)
                .compact();
    }

    /**
     * Parses a signed JWT token.
     *
     * @param token token to parse
     * @return parsed claims
     */
    public Claims parseToken(final String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * Validates a signed JWT token.
     *
     * @param token token to validate
     * @return true when token is valid
     */
    public boolean validateToken(final String token) {
        boolean valid = false;
        try {
            parseToken(token);
            valid = true;
        }
        catch (ExpiredJwtException ex) {
            warnIfEnabled("JWT token is expired: {}", ex.getMessage());
        }
        catch (UnsupportedJwtException ex) {
            warnIfEnabled("JWT token is unsupported: {}", ex.getMessage());
        }
        catch (MalformedJwtException ex) {
            warnIfEnabled("JWT token is malformed: {}", ex.getMessage());
        }
        catch (SignatureException ex) {
            warnIfEnabled("JWT signature validation failed: {}", ex.getMessage());
        }
        catch (IllegalArgumentException ex) {
            warnIfEnabled("JWT token is empty or null: {}", ex.getMessage());
        }
        return valid;
    }

    /**
     * Returns the user id stored in the token subject.
     *
     * @param token token to inspect
     * @return user id from token subject
     */
    public Long getUserIdFromToken(final String token) {
        final Claims claims = parseToken(token);
        return Long.valueOf(claims.getSubject());
    }

    /**
     * Returns whether a token is expired.
     *
     * @param token token to inspect
     * @return true when the token is expired
     */
    public boolean isTokenExpired(final String token) {
        boolean expired;
        try {
            final Claims claims = parseToken(token);
            expired = claims.getExpiration().toInstant().isBefore(Instant.now());
        }
        catch (ExpiredJwtException ex) {
            expired = true;
        }
        return expired;
    }

    /**
     * Returns the expiration time of a token.
     *
     * @param token token to inspect
     * @return expiration time
     */
    public Date getExpirationDateFromToken(final String token) {
        return parseToken(token).getExpiration();
    }

    /**
     * Returns whether the token is a refresh token.
     *
     * @param token token to inspect
     * @return true when the token type is refresh
     */
    public boolean isRefreshToken(final String token) {
        boolean refreshToken;
        try {
            final Claims claims = parseToken(token);
            refreshToken = "refresh".equals(claims.get("type"));
        }
        catch (JwtException | IllegalArgumentException ex) {
            refreshToken = false;
        }
        return refreshToken;
    }

    private void warnIfEnabled(final String message, final String detail) {
        if (log.isWarnEnabled()) {
            log.warn(message, detail);
        }
    }
}
