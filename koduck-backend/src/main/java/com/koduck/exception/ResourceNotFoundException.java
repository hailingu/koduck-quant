package com.koduck.exception;

import lombok.Getter;

/**
 * 资源不存在异常。
 *
 * <p>用于表示请求的资源不存在，如用户、凭证等未找到。</p>
 *
 * @author Koduck Team
 */
@Getter
public class ResourceNotFoundException extends BusinessException {

    /**
     * 资源类型
     */
    private final String resourceType;

    /**
     * 资源 ID
     */
    private final Object resourceId;

    /**
     * 创建资源不存在异常。
     *
     * @param message 错误消息
     */
    public ResourceNotFoundException(String message) {
        super(ErrorCode.RESOURCE_NOT_FOUND.getCode(), message);
        this.resourceType = null;
        this.resourceId = null;
    }

    /**
     * 创建资源不存在异常。
     *
     * @param errorCode 错误码枚举
     */
    public ResourceNotFoundException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.resourceType = null;
        this.resourceId = null;
    }

    /**
     * 创建资源不存在异常。
     *
     * @param resourceType 资源类型（如 "用户", "凭证"）
     * @param resourceId   资源 ID
     */
    public ResourceNotFoundException(String resourceType, Object resourceId) {
        super(ErrorCode.RESOURCE_NOT_FOUND.getCode(), resourceType + "不存在: " + resourceId);
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    /**
     * 创建资源不存在异常。
     *
     * @param errorCode    错误码枚举
     * @param resourceType 资源类型
     * @param resourceId   资源 ID
     */
    public ResourceNotFoundException(ErrorCode errorCode, String resourceType, Object resourceId) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    /**
     * 快速创建资源不存在异常。
     *
     * @param resourceType 资源类型
     * @param resourceId   资源 ID
     * @return ResourceNotFoundException
     */
    public static ResourceNotFoundException of(String resourceType, Object resourceId) {
        return new ResourceNotFoundException(resourceType, resourceId);
    }
}
