package com.koduck.dto.user.user;

/**
 * 头像存储结果。
 *
 * @param avatarUrl 对外返回的头像访问地址
 * @param storageKey 底层对象存储键
 */
public record StoredAvatar(String avatarUrl, String storageKey) {
}
