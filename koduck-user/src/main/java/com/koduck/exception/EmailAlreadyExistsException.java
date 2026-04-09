package com.koduck.exception;

public class EmailAlreadyExistsException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public EmailAlreadyExistsException(String email) {
        super("邮箱已被使用: " + email);
    }
}
