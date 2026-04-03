package com.koduck.identity.application;

import com.koduck.dto.profile.ProfileDTO;
import com.koduck.dto.profile.UpdateProfileRequest;
import com.koduck.service.ProfileService;

import org.springframework.stereotype.Service;

/**
 * Profile management service implementation.
 *
 * @author Koduck Team
 */
@Service
public class ProfileServiceImpl implements ProfileService {

    @Override
    public ProfileDTO getProfile(Long userId) {
        return ProfileDTO.builder().build();
    }

    @Override
    public ProfileDTO updateProfile(Long userId, UpdateProfileRequest request) {
        return ProfileDTO.builder().build();
    }
}
