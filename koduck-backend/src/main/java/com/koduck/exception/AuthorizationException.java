package com.koduck.exception;

import java.io.Serial;

/**
 * Exception for authorization and permission failures.
 *
 * <p>Used when an authenticated user attempts operations without enough
 * privileges.</p>
 *
 * @author Koduck Team
 */
public class AuthorizationException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * Creates an authorization exception with custom message.
     *
     * @param message error message
     */
    public AuthorizationException(String message) {
        super(ErrorCode.FORBIDDEN.getCode(), message);
    }

    /**
     * Creates an authorization exception from predefined error code.
     *
     * @param errorCode authorization-related error code
     */
    public AuthorizationException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
    }

    /**
     * Creates an authorization exception from error code and custom message.
     *
     * @param errorCode authorization-related error code
     * @param message custom error message
     */
    public AuthorizationException(ErrorCode errorCode, String message) {
        super(errorCode.getCode(), message);
    }

    /**
     * Factory method for access denied errors.
     *
     * @return exception instance
     */
    public static AuthorizationException accessDenied() {
        return new AuthorizationException(ErrorCode.AUTH_ACCESS_DENIED);
    }

    /**
     * Factory method for generic operation-not-allowed errors.
     *
     * @param message custom error message
     * @return exception instance
     */
    public static AuthorizationException operationNotAllowed(String message) {
        return new AuthorizationException(ErrorCode.OPERATION_NOT_ALLOWED, message);
    }
}
