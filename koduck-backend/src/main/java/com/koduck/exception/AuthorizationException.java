package com.koduck.exception;

/**
 * 授权异常。
 *
 * <p>用于表示用户权限不足、访问被拒绝的情况。</p>
 *
 * @author Koduck Team
 */
public class AuthorizationException extends BusinessException {

    /**
     * 创建授权异常。
     *
     * @param message 错误消息
     */
    public AuthorizationException(String message) {
        super(ErrorCode.FORBIDDEN.getCode(), message);
    }

    /**
     * 创建授权异常。
     *
     * @param errorCode 错误码枚举
     */
    public AuthorizationException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
    }

    /**
     * 创建授权异常。
     *
     * @param errorCode 错误码枚举
     * @param message   自定义错误消息
     */
    public AuthorizationException(ErrorCode errorCode, String message) {
        super(errorCode.getCode(), message);
    }

    /**
     * 访问被拒绝。
     *
     * @return AuthorizationException
     */
    public static AuthorizationException accessDenied() {
        return new AuthorizationException(ErrorCode.AUTH_ACCESS_DENIED);
    }

    /**
     * 操作不允许。
     *
     * @param message 具体原因
     * @return AuthorizationException
     */
    public static AuthorizationException operationNotAllowed(String message) {
        return new AuthorizationException(ErrorCode.OPERATION_NOT_ALLOWED, message);
    }
}
