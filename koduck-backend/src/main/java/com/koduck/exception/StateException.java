package com.koduck.exception;

import lombok.Getter;

/**
 * 
 *
 * <p></p>
 *
 * @author Koduck Team
 */
@Getter
public class StateException extends BusinessException {

    /**
     * 
     */
    private final String currentState;

    /**
     * 
     */
    private final String expectedState;

    /**
     * 
     *
     * @param message 
     */
    public StateException(String message) {
        super(ErrorCode.INVALID_STATE.getCode(), message);
        this.currentState = null;
        this.expectedState = null;
    }

    /**
     * 
     *
     * @param errorCode 
     */
    public StateException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.currentState = null;
        this.expectedState = null;
    }

    /**
     * 
     *
     * @param currentState  
     * @param expectedState 
     */
    public StateException(String currentState, String expectedState) {
        super(ErrorCode.INVALID_STATE.getCode(),
                String.format("状态异常: 当前状态 [%s]，期望状态 [%s]", currentState, expectedState));
        this.currentState = currentState;
        this.expectedState = expectedState;
    }

    /**
     * 
     *
     * @param currentState  
     * @param expectedState 
     * @param message       
     */
    public StateException(String currentState, String expectedState, String message) {
        super(ErrorCode.INVALID_STATE.getCode(), message);
        this.currentState = currentState;
        this.expectedState = expectedState;
    }
}
