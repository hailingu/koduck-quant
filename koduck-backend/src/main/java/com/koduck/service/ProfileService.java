package com.koduck.service;

import com.koduck.dto.profile.ProfileDTO;
import com.koduck.dto.profile.UpdateProfileDTO;

/**
 * Profile management service.
 */
public interface ProfileService {
    
    ProfileDTO getProfile(Long userId);
    
    ProfileDTO updateProfile(Long userId, UpdateProfileDTO dto);
}
