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
 * WebSocket 通道拦截器
 *
 * <p>处理 WebSocket 连接认证和消息路由：</p>
 * <ul>
 *   <li>CONNECT 时验证 JWT Token</li>
 *   <li>将用户信息绑定到 WebSocket Session</li>
 *   <li>处理断开连接</li>
 * </ul>
 */
@Slf4j
@RequiredArgsConstructor
public class WebSocketChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtUtil jwtUtil;
    private final JwtConfig jwtConfig;

    /**
     * 处理拦截的消息
     *
     * @param message 消息对象
     * @return 处理后的消息
     */
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null) {
            return message;
        }

        // 处理连接命令 - 验证 JWT Token
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            handleConnect(accessor);
        }
        // 处理断开连接
        else if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
            handleDisconnect(accessor);
        }

        return message;
    }

    /**
     * 处理 WebSocket 连接
     *
     * @param accessor STOMP 头部访问器
     */
    private void handleConnect(StompHeaderAccessor accessor) {
        // 从 STOMP 头部获取 Token
        String bearerToken = accessor.getFirstNativeHeader(jwtConfig.getHeaderName());

        if (!StringUtils.hasText(bearerToken)) {
            log.warn("WebSocket 连接 Token 为空");
            return;
        }

        // 移除 Bearer 前缀（如果存在）
        if (bearerToken.startsWith(BEARER_PREFIX)) {
            bearerToken = bearerToken.substring(BEARER_PREFIX.length());
        }

        try {
            if (jwtUtil.validateToken(bearerToken)) {
                Long userId = jwtUtil.getUserIdFromToken(bearerToken);

                // 创建认证对象（使用简单的 Principal）
                WebSocketUserPrincipal principal = new WebSocketUserPrincipal(userId);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                principal,
                                null,
                                Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))
                        );

                // 设置认证到 Security Context
                SecurityContextHolder.getContext().setAuthentication(authentication);

                // 将用户信息存储到 Session
                accessor.setUser(authentication);

                log.info("WebSocket 用户认证成功: userId={}", userId);
            } else {
                log.warn("WebSocket 连接 Token 验证失败");
            }
        } catch (Exception e) {
            log.error("WebSocket 连接认证异常: {}", e.getMessage());
        }
    }

    /**
     * 处理 WebSocket 断开连接
     *
     * @param accessor STOMP 头部访问器
     */
    private void handleDisconnect(StompHeaderAccessor accessor) {
        if (accessor.getUser() != null) {
            log.info("WebSocket 用户断开连接: {}", accessor.getUser().getName());
        }
    }

    /**
     * WebSocket 用户 Principal
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
