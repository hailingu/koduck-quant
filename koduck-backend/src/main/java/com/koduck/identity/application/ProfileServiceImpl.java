package com.koduck.identity.application;
import org.springframework.stereotype.Service;

import com.koduck.dto.profile.ProfileDTO;
import com.koduck.dto.profile.UpdateProfileDTO;
import com.koduck.service.ProfileService;

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
