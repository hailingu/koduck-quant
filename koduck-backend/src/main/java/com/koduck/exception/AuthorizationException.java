package com.koduck.exception;

/**
 * 
 *
 * <p></p>
 *
 * @author Koduck Team
 */
public class AuthorizationException extends BusinessException {

    /**
     * 
     *
     * @param message 
     */
    public AuthorizationException(String message) {
        super(ErrorCode.FORBIDDEN.getCode(), message);
    }

    /**
     * 
     *
     * @param errorCode 
     */
    public AuthorizationException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
    }

    /**
     * 
     *
     * @param errorCode 
     * @param message   
     */
    public AuthorizationException(ErrorCode errorCode, String message) {
        super(errorCode.getCode(), message);
    }

    /**
     * 
     *
     * @return AuthorizationException
     */
    public static AuthorizationException accessDenied() {
        return new AuthorizationException(ErrorCode.AUTH_ACCESS_DENIED);
    }

    /**
     * 
     *
     * @param message 
     * @return AuthorizationException
     */
    public static AuthorizationException operationNotAllowed(String message) {
        return new AuthorizationException(ErrorCode.OPERATION_NOT_ALLOWED, message);
    }
}
