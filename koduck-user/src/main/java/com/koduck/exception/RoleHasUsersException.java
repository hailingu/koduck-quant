package com.koduck.exception;

public class RoleHasUsersException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public RoleHasUsersException(Integer roleId) {
        super("角色仍有用户关联，无法删除: roleId=" + roleId);
    }
}
