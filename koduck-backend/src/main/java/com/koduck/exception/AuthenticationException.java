package com.koduck.exception;

import java.io.Serial;

/**
 * 
 *
 * <p>，</p>
 *
 * @author Koduck Team
 */
public class AuthenticationException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 
     *
     * @param message 
     */
    public AuthenticationException(String message) {
        super(ErrorCode.AUTH_ERROR.getCode(), message);
    }

    /**
     * 
     *
     * @param errorCode 
     */
    public AuthenticationException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
    }

    /**
     * 
     *
     * @param errorCode 
     * @param message   
     */
    public AuthenticationException(ErrorCode errorCode, String message) {
        super(errorCode.getCode(), message);
    }

    /**
     * 
     *
     * @return AuthenticationException
     */
    public static AuthenticationException invalidCredentials() {
        return new AuthenticationException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    /**
     * 
     *
     * @return AuthenticationException
     */
    public static AuthenticationException tokenExpired() {
        return new AuthenticationException(ErrorCode.AUTH_TOKEN_EXPIRED);
    }

    /**
     * 
     *
     * @return AuthenticationException
     */
    public static AuthenticationException tokenInvalid() {
        return new AuthenticationException(ErrorCode.AUTH_TOKEN_INVALID);
    }

    /**
     * 
     *
     * @return AuthenticationException
     */
    public static AuthenticationException accountDisabled() {
        return new AuthenticationException(ErrorCode.AUTH_ACCOUNT_DISABLED);
    }

    /**
     * 
     *
     * @return AuthenticationException
     */
    public static AuthenticationException accountLocked() {
        return new AuthenticationException(ErrorCode.AUTH_ACCOUNT_LOCKED);
    }
}
