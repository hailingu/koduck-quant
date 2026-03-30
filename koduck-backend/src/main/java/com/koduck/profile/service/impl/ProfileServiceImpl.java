package com.koduck.profile.service.impl;

import com.koduck.profile.dto.ProfileDTO;
import com.koduck.profile.dto.UpdateProfileDTO;
import com.koduck.profile.service.ProfileService;
import org.springframework.stereotype.Service;

/**
 * Profile management service implementation.
 */
@Service
public class ProfileServiceImpl implements ProfileService {
    
    @Override
    public ProfileDTO getProfile(Long userId) {
        return ProfileDTO.builder().build();
    }
    
    @Override
    public ProfileDTO updateProfile(Long userId, UpdateProfileDTO dto) {
        return ProfileDTO.builder().build();
    }
}
