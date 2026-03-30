package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.profile.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Profile management controller.
 */
@RestController
@RequestMapping("/api/v1/profile")
public class ProfileController {

    @GetMapping
    public ApiResponse<ProfileResponse> getProfile() {
        return ApiResponse.success(ProfileResponse.builder().build());
    }

    @PutMapping
    public ApiResponse<ProfileResponse> updateProfile(@RequestBody UpdateProfileRequest request) {
        return ApiResponse.success(ProfileResponse.builder().build());
    }

    @PostMapping("/avatar")
    public ApiResponse<AvatarResponse> uploadAvatar(@RequestParam("file") MultipartFile file) {
        return ApiResponse.success(AvatarResponse.builder().build());
    }

    @GetMapping("/preferences")
    public ApiResponse<PreferencesResponse> getPreferences() {
        return ApiResponse.success(PreferencesResponse.builder().build());
    }

    @PutMapping("/preferences")
    public ApiResponse<PreferencesResponse> updatePreferences(@RequestBody UpdatePreferencesRequest request) {
        return ApiResponse.success(PreferencesResponse.builder().build());
    }
}
