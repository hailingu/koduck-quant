package com.koduck.dto.user.user;

/**
 * 头像文件载荷。
 *
 * @param bytes 文件二进制内容
 * @param contentType 文件内容类型
 */
public record AvatarFilePayload(byte[] bytes, String contentType) {
}
