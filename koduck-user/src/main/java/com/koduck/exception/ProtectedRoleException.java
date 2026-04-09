package com.koduck.exception;

public class ProtectedRoleException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public ProtectedRoleException(String name) {
        super("系统保留角色不可删除: " + name);
    }
}
