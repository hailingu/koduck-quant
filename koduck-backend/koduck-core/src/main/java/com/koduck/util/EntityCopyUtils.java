package com.koduck.util;

import com.koduck.entity.auth.User;

/**
 * Entity defensive copy helpers.
 *
 * @author GitHub Copilot
 */
public final class EntityCopyUtils {

    private EntityCopyUtils() {
    }

    /**
     * Creates a detached copy of a user entity.
     *
     * @param source source entity
     * @return copied user or null when source is null
     */
    public static User copyUser(final User source) {
        User copied = null;
        if (source == null) {
            return copied;
        }
        copied = User.builder()
                .id(source.getId())
                .username(source.getUsername())
                .email(source.getEmail())
                .passwordHash(source.getPasswordHash())
                .nickname(source.getNickname())
                .avatarUrl(source.getAvatarUrl())
                .status(source.getStatus())
                .emailVerifiedAt(source.getEmailVerifiedAt())
                .lastLoginAt(source.getLastLoginAt())
                .lastLoginIp(source.getLastLoginIp())
                .createdAt(source.getCreatedAt())
                .updatedAt(source.getUpdatedAt())
                .build();
        return copied;
    }
}
