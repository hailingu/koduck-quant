package com.koduck.acl.impl;

import org.springframework.stereotype.Service;

import com.koduck.acl.UserSettingsQueryService;
import com.koduck.dto.settings.LlmConfigDto;
import com.koduck.service.UserSettingsService;

import lombok.RequiredArgsConstructor;

/**
 * 用户设置查询服务实现（防腐层）。
 *
 * @author Koduck Team
 */
@Service
@RequiredArgsConstructor
public class UserSettingsQueryServiceImpl implements UserSettingsQueryService {

    private final UserSettingsService userSettingsService;

    @Override
    public LlmConfigDto getLlmConfig(Long userId, String provider) {
        // Delegate to getEffectiveLlmConfig as getLlmConfig is not available
        return userSettingsService.getEffectiveLlmConfig(userId, provider);
    }

    @Override
    public LlmConfigDto getEffectiveLlmConfig(Long userId, String provider) {
        return userSettingsService.getEffectiveLlmConfig(userId, provider);
    }
}
