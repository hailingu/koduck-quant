package com.koduck.service;

import com.koduck.dto.profile.ProfileDTO;
import com.koduck.dto.profile.UpdateProfileRequest;

/**
 * Profile management service.
 *
 * @author GitHub Copilot
 */
public interface ProfileService {

    /**
     * Gets user profile by user ID.
     *
     * @param userId the user ID
     * @return the profile DTO
     */
    ProfileDTO getProfile(Long userId);

    /**
     * Updates user profile.
     *
     * @param userId the user ID
     * @param request the update profile request
     * @return the updated profile DTO
     */
    ProfileDTO updateProfile(Long userId, UpdateProfileRequest request);
}
