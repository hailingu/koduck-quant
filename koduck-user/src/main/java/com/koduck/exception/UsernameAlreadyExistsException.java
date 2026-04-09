package com.koduck.exception;

public class UsernameAlreadyExistsException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public UsernameAlreadyExistsException(String username) {
        super("用户名已存在: " + username);
    }
}
