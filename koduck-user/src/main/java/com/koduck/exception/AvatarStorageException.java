package com.koduck.exception;

/**
 * 头像存储异常。
 */
public class AvatarStorageException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public AvatarStorageException(String message) {
        super(message);
    }

    public AvatarStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
