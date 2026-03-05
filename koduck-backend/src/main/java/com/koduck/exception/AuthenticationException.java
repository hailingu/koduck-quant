package com.koduck.exception;

/**
 * 认证异常。
 *
 * <p>用于表示用户认证失败的情况，如登录失败、令牌无效等。</p>
 *
 * @author Koduck Team
 */
public class AuthenticationException extends BusinessException {

    /**
     * 创建认证异常。
     *
     * @param message 错误消息
     */
    public AuthenticationException(String message) {
        super(ErrorCode.AUTH_ERROR.getCode(), message);
    }

    /**
     * 创建认证异常。
     *
     * @param errorCode 错误码枚举
     */
    public AuthenticationException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
    }

    /**
     * 创建认证异常。
     *
     * @param errorCode 错误码枚举
     * @param message   自定义错误消息
     */
    public AuthenticationException(ErrorCode errorCode, String message) {
        super(errorCode.getCode(), message);
    }

    /**
     * 用户名或密码错误。
     *
     * @return AuthenticationException
     */
    public static AuthenticationException invalidCredentials() {
        return new AuthenticationException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    /**
     * 令牌过期。
     *
     * @return AuthenticationException
     */
    public static AuthenticationException tokenExpired() {
        return new AuthenticationException(ErrorCode.AUTH_TOKEN_EXPIRED);
    }

    /**
     * 令牌无效。
     *
     * @return AuthenticationException
     */
    public static AuthenticationException tokenInvalid() {
        return new AuthenticationException(ErrorCode.AUTH_TOKEN_INVALID);
    }

    /**
     * 账号已被禁用。
     *
     * @return AuthenticationException
     */
    public static AuthenticationException accountDisabled() {
        return new AuthenticationException(ErrorCode.AUTH_ACCOUNT_DISABLED);
    }

    /**
     * 账号已被锁定。
     *
     * @return AuthenticationException
     */
    public static AuthenticationException accountLocked() {
        return new AuthenticationException(ErrorCode.AUTH_ACCOUNT_LOCKED);
    }
}
