package com.koduck.exception;
import java.io.Serial;

import lombok.Getter;

/**
 * Exception for invalid state transitions.
 *
 * <p>Used when current entity/process state does not match expected state.</p>
 *
 * @author Koduck Team
 */
@Getter
public class StateException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * Current state value.
     */
    private final String currentState;

    /**
     * Expected state value.
     */
    private final String expectedState;

    /**
     * Creates a state exception with custom message.
     *
     * @param message error message
     */
    public StateException(String message) {
        super(ErrorCode.INVALID_STATE.getCode(), message);
        this.currentState = null;
        this.expectedState = null;
    }

    /**
     * Creates a state exception from predefined error code.
     *
     * @param errorCode state-related error code
     */
    public StateException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.currentState = null;
        this.expectedState = null;
    }

    /**
     * Creates a state exception from current/expected states.
     *
     * @param currentState current state
     * @param expectedState expected state
     */
    public StateException(String currentState, String expectedState) {
        super(ErrorCode.INVALID_STATE.getCode(),
                String.format("状态异常: 当前状态 [%s]，期望状态 [%s]", currentState, expectedState));
        this.currentState = currentState;
        this.expectedState = expectedState;
    }

    /**
     * Creates a state exception with explicit state values and custom message.
     *
     * @param currentState current state
     * @param expectedState expected state
     * @param message custom error message
     */
    public StateException(String currentState, String expectedState, String message) {
        super(ErrorCode.INVALID_STATE.getCode(), message);
        this.currentState = currentState;
        this.expectedState = expectedState;
    }
}
