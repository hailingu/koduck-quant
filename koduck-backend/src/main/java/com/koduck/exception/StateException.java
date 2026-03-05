package com.koduck.exception;

import lombok.Getter;

/**
 * 状态异常。
 *
 * <p>用于表示对象状态不正确导致无法执行操作的情况。</p>
 *
 * @author Koduck Team
 */
@Getter
public class StateException extends BusinessException {

    /**
     * 当前状态
     */
    private final String currentState;

    /**
     * 期望状态
     */
    private final String expectedState;

    /**
     * 创建状态异常。
     *
     * @param message 错误消息
     */
    public StateException(String message) {
        super(ErrorCode.INVALID_STATE.getCode(), message);
        this.currentState = null;
        this.expectedState = null;
    }

    /**
     * 创建状态异常。
     *
     * @param errorCode 错误码枚举
     */
    public StateException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.currentState = null;
        this.expectedState = null;
    }

    /**
     * 创建状态异常。
     *
     * @param currentState  当前状态
     * @param expectedState 期望状态
     */
    public StateException(String currentState, String expectedState) {
        super(ErrorCode.INVALID_STATE.getCode(),
                String.format("状态异常: 当前状态 [%s]，期望状态 [%s]", currentState, expectedState));
        this.currentState = currentState;
        this.expectedState = expectedState;
    }

    /**
     * 创建状态异常。
     *
     * @param currentState  当前状态
     * @param expectedState 期望状态
     * @param message       自定义错误消息
     */
    public StateException(String currentState, String expectedState, String message) {
        super(ErrorCode.INVALID_STATE.getCode(), message);
        this.currentState = currentState;
        this.expectedState = expectedState;
    }
}
