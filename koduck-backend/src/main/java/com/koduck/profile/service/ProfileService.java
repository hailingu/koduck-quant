package com.koduck.profile.service;

import com.koduck.profile.dto.ProfileDTO;
import com.koduck.profile.dto.UpdateProfileDTO;
import org.springframework.stereotype.Service;

/**
 * Profile management service.
 */
@Service
public class ProfileService {
    
    public ProfileDTO getProfile(Long userId) {
        return ProfileDTO.builder().build();
    }
    
    public ProfileDTO updateProfile(Long userId, UpdateProfileDTO dto) {
        return ProfileDTO.builder().build();
    }
}
