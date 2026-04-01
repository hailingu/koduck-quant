package com.koduck.exception;

import lombok.Getter;

import java.io.Serial;

/**
 * Exception for missing resources.
 *
 * <p>Used when required domain entities cannot be found by ID or by business key.</p>
 *
 * @author Koduck Team
 */
@Getter
public class ResourceNotFoundException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * Resource type, for example "user" or "strategy".
     */
    private final String resourceType;

    /**
     * Missing resource identifier.
     */
    private final transient Object resourceId;

    /**
     * Creates an exception with custom message.
     *
     * @param message error message
     */
    public ResourceNotFoundException(String message) {
        super(ErrorCode.RESOURCE_NOT_FOUND.getCode(), message);
        this.resourceType = null;
        this.resourceId = null;
    }

    /**
     * Creates an exception from predefined error code.
     *
     * @param errorCode resource-not-found related error code
     */
    public ResourceNotFoundException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.resourceType = null;
        this.resourceId = null;
    }

    /**
     * Creates an exception from resource type and identifier.
     *
     * @param resourceType resource type (for example "user", "signal")
     * @param resourceId resource identifier
     */
    public ResourceNotFoundException(String resourceType, Object resourceId) {
        super(ErrorCode.RESOURCE_NOT_FOUND.getCode(), resourceType + "不存在: " + resourceId);
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    /**
     * Creates an exception from explicit error code plus resource identity.
     *
     * @param errorCode resource-not-found related error code
     * @param resourceType resource type
     * @param resourceId resource identifier
     */
    public ResourceNotFoundException(ErrorCode errorCode, String resourceType, Object resourceId) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    /**
     * Factory method for common resource-not-found case.
     *
     * @param resourceType resource type
     * @param resourceId resource identifier
     * @return exception instance
     */
    public static ResourceNotFoundException of(String resourceType, Object resourceId) {
        return new ResourceNotFoundException(resourceType, resourceId);
    }
}
