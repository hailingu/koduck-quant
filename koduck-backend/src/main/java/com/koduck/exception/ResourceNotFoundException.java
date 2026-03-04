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
     * 默认错误码：404
     */
    private static final int NOT_FOUND_CODE = 404;

    /**
     * 创建资源不存在异常。
     *
     * @param message 错误消息
     */
    public ResourceNotFoundException(String message) {
        super(NOT_FOUND_CODE, message);
    }

    /**
     * 创建资源不存在异常。
     *
     * @param resourceType 资源类型（如 "用户", "凭证"）
     * @param resourceId   资源 ID
     */
    public ResourceNotFoundException(String resourceType, Object resourceId) {
        super(NOT_FOUND_CODE, resourceType + "不存在: " + resourceId);
    }
}
