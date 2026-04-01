package com.koduck.exception;

import java.io.Serial;

/**
 * Exception for authentication failures.
 *
 * <p>Used for identity verification errors such as invalid credentials,
 * token issues, or disabled/locked account states.</p>
 *
 * @author Koduck Team
 */
public class AuthenticationException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * Creates an authentication exception with custom message.
     *
     * @param message error message
     */
    public AuthenticationException(String message) {
        super(ErrorCode.AUTH_ERROR.getCode(), message);
    }

    /**
     * Creates an authentication exception from predefined error code.
     *
     * @param errorCode authentication-related error code
     */
    public AuthenticationException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
    }

    /**
     * Creates an authentication exception from error code and custom message.
     *
     * @param errorCode authentication-related error code
     * @param message custom error message
     */
    public AuthenticationException(ErrorCode errorCode, String message) {
        super(errorCode.getCode(), message);
    }

    /**
     * Factory method for invalid credential errors.
     *
     * @return exception instance
     */
    public static AuthenticationException invalidCredentials() {
        return new AuthenticationException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    /**
     * Factory method for expired token errors.
     *
     * @return exception instance
     */
    public static AuthenticationException tokenExpired() {
        return new AuthenticationException(ErrorCode.AUTH_TOKEN_EXPIRED);
    }

    /**
     * Factory method for invalid token errors.
     *
     * @return exception instance
     */
    public static AuthenticationException tokenInvalid() {
        return new AuthenticationException(ErrorCode.AUTH_TOKEN_INVALID);
    }

    /**
     * Factory method for disabled account errors.
     *
     * @return exception instance
     */
    public static AuthenticationException accountDisabled() {
        return new AuthenticationException(ErrorCode.AUTH_ACCOUNT_DISABLED);
    }

    /**
     * Factory method for locked account errors.
     *
     * @return exception instance
     */
    public static AuthenticationException accountLocked() {
        return new AuthenticationException(ErrorCode.AUTH_ACCOUNT_LOCKED);
    }
}
