package com.koduck.exception;

public class RoleNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public RoleNotFoundException(Integer id) {
        super("角色不存在: id=" + id);
    }

    public RoleNotFoundException(String name) {
        super("角色不存在: name=" + name);
    }
}
