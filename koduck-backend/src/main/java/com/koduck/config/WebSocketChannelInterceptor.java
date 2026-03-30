package com.koduck.config;
import com.koduck.util.JwtUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import java.io.Serial;
import java.util.Collections;
import java.util.Objects;
import java.util.Optional;
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
@Component
public class WebSocketChannelInterceptor implements ChannelInterceptor {
    private static final String BEARER_PREFIX = "Bearer ";
    @org.springframework.beans.factory.annotation.Autowired
    private JwtUtil jwtUtil;
    @org.springframework.beans.factory.annotation.Autowired
    private JwtConfig jwtConfig;
    /**
     * 
     *
     * @param message 
     * @return 
     */
    @Override
    public Message<?> preSend(@NonNull Message<?> message, MessageChannel channel) {
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
        String headerName = Objects.requireNonNull(
            jwtConfig.getHeaderName(),
            "JWT header name must not be null"
        );
        Optional<String> bearerTokenOptional = Optional
            .ofNullable(accessor.getFirstNativeHeader(headerName))
            .filter(StringUtils::hasText);
        if (bearerTokenOptional.isEmpty()) {
            log.warn("WebSocket  Token ");
            return;
        }
        String bearerToken = bearerTokenOptional.get();
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
        java.security.Principal user = accessor.getUser();
        if (user != null) {
            log.info("WebSocket : {}", user.getName());
        }
    }
    /**
     * WebSocket  Principal
     */
    public static class WebSocketUserPrincipal implements org.springframework.security.core.userdetails.UserDetails {
        @Serial
        private static final long serialVersionUID = 1L;
        @org.springframework.beans.factory.annotation.Autowired
        private Long userId;
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
