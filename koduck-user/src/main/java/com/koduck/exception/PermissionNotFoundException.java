package com.koduck.exception;

import java.util.Set;

public class PermissionNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public PermissionNotFoundException(Integer id) {
        super("权限不存在: id=" + id);
    }

    public PermissionNotFoundException(Set<Integer> ids) {
        super("部分权限不存在: ids=" + ids);
    }
}
