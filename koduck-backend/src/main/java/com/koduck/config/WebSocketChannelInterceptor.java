package com.koduck.config;

import com.koduck.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;

import java.util.Collections;

/**
 * WebSocket 
 *
 * <p> WebSocket ：</p>
 * <ul>
 *   <li>CONNECT  JWT Token</li>
 *   <li> WebSocket Session</li>
 *   <li></li>
 * </ul>
 */
@Slf4j
@RequiredArgsConstructor
public class WebSocketChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtUtil jwtUtil;
    private final JwtConfig jwtConfig;

    /**
     * 
     *
     * @param message 
     * @return 
     */
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null) {
            return message;
        }

        //  -  JWT Token
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            handleConnect(accessor);
        }
        // 
        else if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
            handleDisconnect(accessor);
        }

        return message;
    }

    /**
     *  WebSocket 
     *
     * @param accessor STOMP 
     */
    private void handleConnect(StompHeaderAccessor accessor) {
        //  STOMP  Token
        String bearerToken = accessor.getFirstNativeHeader(jwtConfig.getHeaderName());

        if (!StringUtils.hasText(bearerToken)) {
            log.warn("WebSocket  Token ");
            return;
        }

        //  Bearer （）
        if (bearerToken.startsWith(BEARER_PREFIX)) {
            bearerToken = bearerToken.substring(BEARER_PREFIX.length());
        }

        try {
            if (jwtUtil.validateToken(bearerToken)) {
                Long userId = jwtUtil.getUserIdFromToken(bearerToken);

                // （ Principal）
                WebSocketUserPrincipal principal = new WebSocketUserPrincipal(userId);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                principal,
                                null,
                                Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))
                        );

                //  Security Context
                SecurityContextHolder.getContext().setAuthentication(authentication);

                //  Session
                accessor.setUser(authentication);

                log.info("WebSocket : userId={}", userId);
            } else {
                log.warn("WebSocket  Token ");
            }
        } catch (Exception e) {
            log.error("WebSocket : {}", e.getMessage());
        }
    }

    /**
     *  WebSocket 
     *
     * @param accessor STOMP 
     */
    private void handleDisconnect(StompHeaderAccessor accessor) {
        if (accessor.getUser() != null) {
            log.info("WebSocket : {}", accessor.getUser().getName());
        }
    }

    /**
     * WebSocket  Principal
     */
    public static class WebSocketUserPrincipal implements org.springframework.security.core.userdetails.UserDetails {

        private final Long userId;

        public WebSocketUserPrincipal(Long userId) {
            this.userId = userId;
        }

        public Long getUserId() {
            return userId;
        }

        @Override
        public String getUsername() {
            return String.valueOf(userId);
        }

        @Override
        public String getPassword() {
            return null;
        }

        @Override
        public java.util.Collection<? extends org.springframework.security.core.GrantedAuthority> getAuthorities() {
            return Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"));
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
