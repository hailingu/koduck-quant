package com.koduck.acl;

import com.koduck.dto.settings.LlmConfigDto;

/**
 * 用户设置查询服务（防腐层接口）。
 * <p>为 AI 模块提供用户设置的只读访问，隐藏底层 Service 实现。</p>
 *
 * @author Koduck Team
 */
public interface UserSettingsQueryService {

    /**
     * 获取用户的 LLM 配置。
     *
     * @param userId 用户ID
     * @param provider LLM 提供商
     * @return LLM 配置
     */
    LlmConfigDto getLlmConfig(Long userId, String provider);

    /**
     * 获取用户的有效 LLM 配置（合并默认配置）。
     *
     * @param userId 用户ID
     * @param provider LLM 提供商
     * @return 有效的 LLM 配置
     */
    LlmConfigDto getEffectiveLlmConfig(Long userId, String provider);
}
