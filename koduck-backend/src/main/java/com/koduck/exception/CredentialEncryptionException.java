package com.koduck.exception;

import java.io.Serial;

/**
 * Exception thrown when credential encryption or decryption fails.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public class CredentialEncryptionException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    public CredentialEncryptionException(String message, Throwable cause) {
        super(ErrorCode.BUSINESS_ERROR.getCode(), message, cause);
    }
}