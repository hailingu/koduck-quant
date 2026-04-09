package com.koduck.exception;

public class UserNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public UserNotFoundException(Long id) {
        super("用户不存在: id=" + id);
    }

    public UserNotFoundException(String field, String value) {
        super("用户不存在: " + field + "=" + value);
    }
}
