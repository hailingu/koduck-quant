package com.koduck.service;

import com.koduck.dto.auth.*;

/**
 * 认证服务接口
 *
 * <p>Token 管理、用户认证与密码重置</p>
 *
 * @author Koduck Team
 */
public interface AuthService {

    /**
     * 用户登录（支持用户名或邮箱登录）
     *
     * @param request   登录请求
     * @param ipAddress IP 地址
     * @param userAgent 用户代理
     * @return Token 响应
     */
    TokenResponse login(LoginRequest request, String ipAddress, String userAgent);

    /**
     * 用户注册
     *
     * @param request 注册请求
     * @return Token 响应
     */
    TokenResponse register(RegisterRequest request);

    /**
     * 刷新 Token
     *
     * @param request 刷新 Token 请求
     * @return Token 响应
     */
    TokenResponse refreshToken(RefreshTokenRequest request);

    /**
     * 用户登出
     *
     * @param refreshTokenValue 刷新 Token
     */
    void logout(String refreshTokenValue);

    /**
     * 获取安全配置
     *
     * @return 安全配置响应
     */
    SecurityConfigResponse getSecurityConfig();

    /**
     * 忘记密码
     *
     * <p>无论邮箱是否存在都返回成功（防止枚举攻击）</p>
     * <p>对同一邮箱/IP 进行限流</p>
     *
     * @param request   忘记密码请求
     * @param ipAddress IP 地址
     */
    void forgotPassword(ForgotPasswordRequest request, String ipAddress);

    /**
     * 重置密码
     *
     * @param request 重置密码请求
     */
    void resetPassword(ResetPasswordRequest request);
}
