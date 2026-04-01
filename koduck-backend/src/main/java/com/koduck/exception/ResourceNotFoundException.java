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
public class ResourceNotFoundException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 
     */
    private final String resourceType;

    /**
     *  ID
     */
    private final transient Object resourceId;

    /**
     * 
     *
     * @param message 
     */
    public ResourceNotFoundException(String message) {
        super(ErrorCode.RESOURCE_NOT_FOUND.getCode(), message);
        this.resourceType = null;
        this.resourceId = null;
    }

    /**
     * 
     *
     * @param errorCode 
     */
    public ResourceNotFoundException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.resourceType = null;
        this.resourceId = null;
    }

    /**
     * 
     *
     * @param resourceType （ "", ""）
     * @param resourceId    ID
     */
    public ResourceNotFoundException(String resourceType, Object resourceId) {
        super(ErrorCode.RESOURCE_NOT_FOUND.getCode(), resourceType + "不存在: " + resourceId);
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    /**
     * 
     *
     * @param errorCode    
     * @param resourceType 
     * @param resourceId    ID
     */
    public ResourceNotFoundException(ErrorCode errorCode, String resourceType, Object resourceId) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    /**
     * 
     *
     * @param resourceType 
     * @param resourceId    ID
     * @return ResourceNotFoundException
     */
    public static ResourceNotFoundException of(String resourceType, Object resourceId) {
        return new ResourceNotFoundException(resourceType, resourceId);
    }
}
