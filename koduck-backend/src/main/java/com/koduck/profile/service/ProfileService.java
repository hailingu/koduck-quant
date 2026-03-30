package com.koduck.profile.service;

import com.koduck.profile.dto.ProfileDTO;
import com.koduck.profile.dto.UpdateProfileDTO;

/**
 * Profile management service.
 */
public interface ProfileService {
    
    ProfileDTO getProfile(Long userId);
    
    ProfileDTO updateProfile(Long userId, UpdateProfileDTO dto);
}
