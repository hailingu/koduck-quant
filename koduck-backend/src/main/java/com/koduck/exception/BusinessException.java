package com.koduck.exception;

import lombok.Getter;

import java.io.Serial;

/**
 * 
 *
 * <p>，</p>
 *
 * @author Koduck Team
 */
@Getter
public class BusinessException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 
     */
    private final int code;

    /**
     * 
     *
     * @param code    
     * @param message 
     */
    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * （）
     *
     * @param message 
     */
    public BusinessException(String message) {
        this(ErrorCode.BUSINESS_ERROR.getCode(), message);
    }

    /**
     * 
     *
     * @param errorCode 
     */
    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.code = errorCode.getCode();
    }

    /**
     * 
     *
     * @param errorCode 
     * @param message   
     */
    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
    }

    /**
     * 
     *
     * @param code    
     * @param message 
     * @param cause   
     */
    public BusinessException(int code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    /**
     * 
     *
     * @param errorCode 
     * @param cause     
     */
    public BusinessException(ErrorCode errorCode, Throwable cause) {
        super(errorCode.getDefaultMessage(), cause);
        this.code = errorCode.getCode();
    }

    /**
     *  HTTP 
     *
     * @return HTTP 
     */
    public int getHttpStatus() {
        ErrorCode errorCode = ErrorCode.fromCode(code);
        return errorCode.getHttpStatus().value();
    }
}
