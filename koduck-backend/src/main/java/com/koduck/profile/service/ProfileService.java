package com.koduck.profile.service;

import org.springframework.stereotype.Service;

@Service
public class ProfileService {
    
    public ProfileDTO getProfile(Long userId) {
        return new ProfileDTO();
    }
    
    public ProfileDTO updateProfile(Long userId, UpdateProfileDTO dto) {
        return new ProfileDTO();
    }
}
