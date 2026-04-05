package com.koduck.strategy.exception;

import com.koduck.exception.BusinessException;

/**
 * 回测领域异常。
 *
 * <p>回测模块的所有业务异常都继承此类。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public class BacktestException extends BusinessException {

    private static final long serialVersionUID = 1L;

    /**
     * 创建回测异常。
     *
     * @param message 错误信息
     */
    public BacktestException(String message) {
        super(message);
    }

    /**
     * 创建回测异常。
     *
     * @param message 错误信息
     * @param cause 原始异常
     */
    public BacktestException(String message, Throwable cause) {
        super(message);
        this.initCause(cause);
    }

    /**
     * 创建回测异常。
     *
     * @param code 错误码
     * @param message 错误信息
     */
    public BacktestException(int code, String message) {
        super(code, message);
    }
}
