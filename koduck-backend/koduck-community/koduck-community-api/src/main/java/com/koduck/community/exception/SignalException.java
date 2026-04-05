package com.koduck.community.exception;

/**
 * 信号领域异常。
 *
 * <p>信号模块的所有业务异常都继承此类。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public class SignalException extends CommunityException {

    private static final long serialVersionUID = 1L;

    /**
     * 创建信号异常。
     *
     * @param message 错误信息
     */
    public SignalException(String message) {
        super(message);
    }

    /**
     * 创建信号异常。
     *
     * @param message 错误信息
     * @param cause 原始异常
     */
    public SignalException(String message, Throwable cause) {
        super(message, cause);
    }

    /**
     * 创建信号异常。
     *
     * @param code 错误码
     * @param message 错误信息
     */
    public SignalException(int code, String message) {
        super(code, message);
    }
}
