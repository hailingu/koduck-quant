package com.koduck.exception;
import java.io.Serial;

import lombok.Getter;

/**
 * 
 *
 * <p>（AI ）</p>
 *
 * @author Koduck Team
 */
@Getter
public class ExternalServiceException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 
     */
    private final String serviceName;

    /**
     * 
     *
     * @param message 
     */
    public ExternalServiceException(String message) {
        super(ErrorCode.EXTERNAL_SERVICE_ERROR.getCode(), message);
        this.serviceName = null;
    }

    /**
     * 
     *
     * @param errorCode 
     */
    public ExternalServiceException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.serviceName = null;
    }

    /**
     * 
     *
     * @param serviceName 
     * @param message     
     */
    public ExternalServiceException(String serviceName, String message) {
        super(ErrorCode.EXTERNAL_SERVICE_ERROR.getCode(),
                String.format("[%s] %s", serviceName, message));
        this.serviceName = serviceName;
    }

    /**
     * 
     *
     * @param serviceName 
     * @param message     
     * @param cause       
     */
    public ExternalServiceException(String serviceName, String message, Throwable cause) {
        super(ErrorCode.EXTERNAL_SERVICE_ERROR.getCode(),
                String.format("[%s] %s", serviceName, message), cause);
        this.serviceName = serviceName;
    }

    /**
     * 
     *
     * @param serviceName 
     * @param message     
     * @return ExternalServiceException
     */
    public static ExternalServiceException of(String serviceName, String message) {
        return new ExternalServiceException(serviceName, message);
    }

    /**
     * 
     *
     * @param serviceName 
     * @param message     
     * @param cause       
     * @return ExternalServiceException
     */
    public static ExternalServiceException of(String serviceName, String message, Throwable cause) {
        return new ExternalServiceException(serviceName, message, cause);
    }
}
