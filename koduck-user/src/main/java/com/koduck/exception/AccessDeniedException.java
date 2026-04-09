package com.koduck.exception;

/**
 * 权限不足异常。
 *
 * <p>当用户不具备访问资源所需的角色或权限时抛出。</p>
 */
public class AccessDeniedException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public AccessDeniedException(String message) {
        super(message);
    }
}
