package com.koduck.community.exception;

import com.koduck.exception.BusinessException;

/**
 * 社区领域异常。
 *
 * <p>社区模块的所有业务异常都继承此类。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public class CommunityException extends BusinessException {

    private static final long serialVersionUID = 1L;

    /**
     * 创建社区异常。
     *
     * @param message 错误信息
     */
    public CommunityException(String message) {
        super(message);
    }

    /**
     * 创建社区异常。
     *
     * @param message 错误信息
     * @param cause 原始异常
     */
    public CommunityException(String message, Throwable cause) {
        super(message);
        this.initCause(cause);
    }

    /**
     * 创建社区异常。
     *
     * @param code 错误码
     * @param message 错误信息
     */
    public CommunityException(int code, String message) {
        super(code, message);
    }
}
