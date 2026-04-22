package com.koduck.service;

import com.koduck.dto.user.user.AvatarFilePayload;
import com.koduck.dto.user.user.StoredAvatar;
import org.springframework.web.multipart.MultipartFile;

/**
 * 头像存储服务。
 */
public interface AvatarStorageService {

    StoredAvatar store(String tenantId, Long userId, MultipartFile file);

    AvatarFilePayload load(String avatarKey);

    void deleteByKey(String storageKey);

    String buildAvatarUrl(String storageKey);
}
