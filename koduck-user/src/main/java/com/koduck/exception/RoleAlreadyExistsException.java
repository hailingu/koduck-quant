package com.koduck.exception;

public class RoleAlreadyExistsException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public RoleAlreadyExistsException(String name) {
        super("角色名已存在: " + name);
    }
}
