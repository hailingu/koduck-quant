package com.koduck.exception;

/**
 * 头像文件不存在异常。
 */
public class AvatarNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public AvatarNotFoundException(String avatarKey) {
        super("头像文件不存在: " + avatarKey);
    }
}
