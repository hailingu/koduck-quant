package com.koduck.acl;

import java.util.Map;
import java.util.Optional;

import lombok.Value;

/**
 * 用户记忆配置查询服务（防腐层接口）。
 * <p>为 AI 模块提供用户记忆配置的读写访问，隐藏底层 Repository 实现。</p>
 *
 * @author Koduck Team
 */
public interface UserMemoryProfileQueryService {

    /**
     * 根据用户ID查找记忆配置。
     *
     * @param userId 用户ID
     * @return 记忆配置
     */
    Optional<UserMemoryProfileDto> findByUserId(Long userId);

    /**
     * 更新用户记忆配置。
     *
     * @param userId 用户ID
     * @param profile 记忆配置
     */
    void updateProfile(Long userId, UserMemoryProfileDto profile);

    /**
     * 用户记忆配置 DTO。
     */
    @Value
    class UserMemoryProfileDto {
        /** 用户ID。 */
        Long userId;

        /** 偏好风格。 */
        String preferredStyle;

        /** 风险承受能力。 */
        String riskTolerance;

        /** 其他偏好设置。 */
        Map<String, Object> preferences;

        /**
         * 创建新的配置对象。
         *
         * @param userId 用户ID
         * @param preferredStyle 偏好风格
         * @param riskTolerance 风险承受能力
         * @param preferences 其他偏好设置
         */
        public UserMemoryProfileDto(Long userId, String preferredStyle,
                                    String riskTolerance, Map<String, Object> preferences) {
            this.userId = userId;
            this.preferredStyle = preferredStyle;
            this.riskTolerance = riskTolerance;
            this.preferences = preferences != null ? Map.copyOf(preferences) : Map.of();
        }
    }
}
