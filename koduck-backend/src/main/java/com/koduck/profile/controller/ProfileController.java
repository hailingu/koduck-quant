package com.koduck.profile.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/profile")
public class ProfileController {

    @GetMapping
    public ProfileResponse getProfile() {
        return new ProfileResponse();
    }

    @PutMapping
    public ProfileResponse updateProfile(@RequestBody UpdateProfileRequest request) {
        return new ProfileResponse();
    }

    @PostMapping("/avatar")
    public AvatarResponse uploadAvatar(@RequestParam("file") MultipartFile file) {
        return new AvatarResponse();
    }

    @GetMapping("/preferences")
    public PreferencesResponse getPreferences() {
        return new PreferencesResponse();
    }

    @PutMapping("/preferences")
    public PreferencesResponse updatePreferences(@RequestBody UpdatePreferencesRequest request) {
        return new PreferencesResponse();
    }
}
