package com.koduck.acl.impl;

import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.koduck.acl.UserMemoryProfileQueryService;
import com.koduck.entity.user.UserMemoryProfile;
import com.koduck.repository.user.UserMemoryProfileRepository;

import lombok.RequiredArgsConstructor;

/**
 * 用户记忆配置查询服务实现（防腐层）。
 *
 * @author Koduck Team
 */
@Service
@RequiredArgsConstructor
public class UserMemoryProfileQueryServiceImpl implements UserMemoryProfileQueryService {

    private final UserMemoryProfileRepository memoryProfileRepository;

    @Override
    public Optional<UserMemoryProfileDto> findByUserId(Long userId) {
        return memoryProfileRepository.findById(userId)
                .map(this::toDto);
    }

    @Override
    public void updateProfile(Long userId, UserMemoryProfileDto profile) {
        UserMemoryProfile entity = memoryProfileRepository.findById(userId)
                .orElseGet(() -> {
                    UserMemoryProfile newProfile = new UserMemoryProfile();
                    newProfile.setUserId(userId);
                    return newProfile;
                });

        entity.setRiskPreference(profile.getRiskTolerance());
        if (profile.getPreferences() != null) {
            // Map preferences to profileFacts
            entity.setProfileFacts(profile.getPreferences());
        }

        memoryProfileRepository.save(entity);
    }

    private UserMemoryProfileDto toDto(UserMemoryProfile profile) {
        return new UserMemoryProfileDto(
                profile.getUserId(),
                null,  // preferredStyle not in entity
                profile.getRiskPreference(),
                profile.getProfileFacts()
        );
    }
}
