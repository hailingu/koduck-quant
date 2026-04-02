package com.koduck.security.websocket;
import java.io.Serial;
import java.security.Principal;
import java.util.Collection;
import java.util.Collections;
import java.util.Objects;

import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.koduck.common.constants.HttpHeaderConstants;
import com.koduck.config.JwtConfig;
import com.koduck.util.JwtUtil;

import lombok.extern.slf4j.Slf4j;

/**
 * Intercepts STOMP channel traffic and performs JWT authentication on CONNECT.
 *
 * <p>Main responsibilities:</p>
 * <ul>
 *   <li>Extract JWT token from the configured header on CONNECT frames.</li>
 *   <li>Validate token and attach authenticated principal to STOMP session.</li>
 *   <li>Clear security context and log disconnect information on DISCONNECT.</li>
 * </ul>
 */
@Slf4j
@Component
public class WebSocketChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = HttpHeaderConstants.BEARER_PREFIX;
    private static final String DEFAULT_AUTHORIZATION_HEADER = HttpHeaderConstants.AUTHORIZATION;
    private static final String ROLE_USER = "ROLE_USER";
    private static final Collection<? extends GrantedAuthority> USER_AUTHORITIES =
            Collections.singletonList(new SimpleGrantedAuthority(ROLE_USER));

    private final JwtUtil jwtUtil;
    private final JwtConfig jwtConfig;

    public WebSocketChannelInterceptor(JwtUtil jwtUtil, JwtConfig jwtConfig) {
        this.jwtUtil = Objects.requireNonNull(jwtUtil, "jwtUtil must not be null");
        this.jwtConfig = Objects.requireNonNull(jwtConfig, "jwtConfig must not be null");
    }

    /**
     * Intercepts outbound STOMP message processing.
     *
     * @param message STOMP message
     * @param channel message channel
     * @return original message after interceptor processing
     */
    @Override
    @SuppressWarnings("java:S2638")
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            handleConnect(accessor);
        } else if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
            handleDisconnect(accessor);
        }

        return message;
    }

    /**
     * Handles STOMP CONNECT authentication flow.
     *
     * @param accessor STOMP header accessor
     */
    private void handleConnect(StompHeaderAccessor accessor) {
        String headerName = Objects.requireNonNull(resolveHeaderName(), "headerName must not be null");
        Object rawAuthorizationObject = accessor.getFirstNativeHeader(headerName);
        String rawAuthorization = rawAuthorizationObject == null ? "" : rawAuthorizationObject.toString();
        String token = extractBearerToken(rawAuthorization);
        if (!StringUtils.hasText(token)) {
            log.warn("WebSocket CONNECT rejected: missing JWT token");
            return;
        }

        try {
            if (!jwtUtil.validateToken(token)) {
                log.warn("WebSocket CONNECT rejected: invalid JWT token");
                return;
            }

            Long userId = jwtUtil.getUserIdFromToken(token);
            if (userId == null) {
                log.warn("WebSocket CONNECT rejected: token does not contain userId");
                return;
            }

            WebSocketUserPrincipal principal = new WebSocketUserPrincipal(userId);
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(principal, null, USER_AUTHORITIES);

            SecurityContextHolder.getContext().setAuthentication(authentication);
            // Keep session principal as WebSocketUserPrincipal for controller-level extraction.
            accessor.setUser(principal);

            log.info("WebSocket CONNECT authenticated: userId={}", userId);
        } catch (RuntimeException ex) {
            log.error("WebSocket CONNECT authentication failed", ex);
        }
    }

    /**
     * Handles STOMP DISCONNECT lifecycle events.
     *
     * @param accessor STOMP header accessor
     */
    private void handleDisconnect(StompHeaderAccessor accessor) {
        Principal user = accessor.getUser();
        if (user != null) {
            log.info("WebSocket DISCONNECT: principal={}", user.getName());
        }
        SecurityContextHolder.clearContext();
    }

    private String resolveHeaderName() {
        String configuredHeaderName = jwtConfig.getHeaderName();
        if (StringUtils.hasText(configuredHeaderName)) {
            return Objects.requireNonNull(configuredHeaderName, "configuredHeaderName must not be null");
        }
        return DEFAULT_AUTHORIZATION_HEADER;
    }

    private String extractBearerToken(String headerValue) {
        if (!StringUtils.hasText(headerValue)) {
            return "";
        }

        String value = headerValue.trim();
        if (value.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            return value.substring(BEARER_PREFIX.length()).trim();
        }

        return value;
    }

    /**
     * Principal stored in STOMP session for authenticated WebSocket users.
     */
    public static class WebSocketUserPrincipal
            implements org.springframework.security.core.userdetails.UserDetails, Principal {

        @Serial
        private static final long serialVersionUID = 1L;

        private final Long userId;

        public WebSocketUserPrincipal(Long userId) {
            this.userId = Objects.requireNonNull(userId, "userId must not be null");
        }

        public Long getUserId() {
            return userId;
        }

        @Override
        public String getName() {
            return getUsername();
        }

        @Override
        public String getUsername() {
            return String.valueOf(userId);
        }

        @Override
        public String getPassword() {
            return "";
        }

        @Override
        public Collection<? extends GrantedAuthority> getAuthorities() {
            return USER_AUTHORITIES;
        }

        @Override
        public boolean isAccountNonExpired() {
            return true;
        }

        @Override
        public boolean isAccountNonLocked() {
            return true;
        }

        @Override
        public boolean isCredentialsNonExpired() {
            return true;
        }

        @Override
        public boolean isEnabled() {
            return true;
        }
    }
}
