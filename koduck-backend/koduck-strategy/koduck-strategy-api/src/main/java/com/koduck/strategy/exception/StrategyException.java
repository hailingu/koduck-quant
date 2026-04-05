package com.koduck.strategy.exception;

import com.koduck.exception.BusinessException;

/**
 * 策略领域异常。
 *
 * <p>策略模块的所有业务异常都继承此类。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public class StrategyException extends BusinessException {

    private static final long serialVersionUID = 1L;

    /**
     * 创建策略异常。
     *
     * @param message 错误信息
     */
    public StrategyException(String message) {
        super(message);
    }

    /**
     * 创建策略异常。
     *
     * @param message 错误信息
     * @param cause 原始异常
     */
    public StrategyException(String message, Throwable cause) {
        super(message);
        this.initCause(cause);
    }

    /**
     * 创建策略异常。
     *
     * @param code 错误码
     * @param message 错误信息
     */
    public StrategyException(int code, String message) {
        super(code, message);
    }
}
