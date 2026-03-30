package com.koduck.controller;
import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.common.PageResponse;
import com.koduck.dto.user.ChangePasswordRequest;
import com.koduck.dto.user.CreateUserRequest;
import com.koduck.dto.user.UpdateProfileRequest;
import com.koduck.dto.user.UpdateUserRequest;
import com.koduck.dto.user.UserDetailResponse;
import com.koduck.dto.user.UserPageRequest;
import com.koduck.security.UserPrincipal;
import com.koduck.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
/**
 * REST API controller for user profile and administrative user management.
 */
@RestController
@RequestMapping("/api/v1/users")
@Validated
@Slf4j
@Tag(name = "User Management", description = "APIs for user profile query/update and admin user management")
public class UserController {
    @org.springframework.beans.factory.annotation.Autowired
    private AuthenticatedUserResolver authenticatedUserResolver;
    @org.springframework.beans.factory.annotation.Autowired
    private UserService userService;
    /**
     * Retrieve current user details.
     */
    @GetMapping("/me")
    public ApiResponse<UserDetailResponse> getCurrentUser(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
        log.debug("GET /api/v1/users/me, userId={}", userId);
        UserDetailResponse response = userService.getCurrentUser(userId);
        return ApiResponse.success(response);
    }
    /**
     * Update current user's profile.
     */
    @PutMapping("/me")
    public ApiResponse<UserDetailResponse> updateProfile(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateProfileRequest request) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
        log.debug("PUT /api/v1/users/me, userId={}", userId);
        UserDetailResponse response = userService.updateProfile(userId, request);
        return ApiResponse.success(response);
    }
    /**
     * Change current user's password.
     */
    @PutMapping("/me/password")
    public ApiResponse<Void> changePassword(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody ChangePasswordRequest request) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);
        log.debug("PUT /api/v1/users/me/password, userId={}", userId);
        userService.changePassword(userId, request);
        return ApiResponse.successNoContent();
    }
    /**
     * List users with pagination for administrators.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<UserDetailResponse>> listUsers(
            @Valid UserPageRequest request) {
        log.debug("GET /api/v1/users, page={}, size={}", request.getPage(), request.getSize());
        PageResponse<UserDetailResponse> response = userService.listUsers(request);
        return ApiResponse.success(response);
    }
    /**
     * Get user detail by user id for administrators.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserDetailResponse> getUserById(
            @PathVariable @Positive(message = "User ID must be positive") Long id) {
        log.debug("GET /api/v1/users/{}, admin request", id);
        UserDetailResponse response = userService.getUserById(id);
        return ApiResponse.success(response);
    }
    /**
     * Create user for administrators.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserDetailResponse> createUser(
            @Valid @RequestBody CreateUserRequest request) {
        log.debug("POST /api/v1/users, username={}", request.getUsername());
        UserDetailResponse response = userService.createUser(request);
        return ApiResponse.success(response);
    }
    /**
     * Update user for administrators.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserDetailResponse> updateUser(
            @PathVariable @Positive(message = "User ID must be positive") Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        log.debug("PUT /api/v1/users/{}, admin request", id);
        UserDetailResponse response = userService.updateUser(id, request);
        return ApiResponse.success(response);
    }
    /**
     * Delete user for administrators.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteUser(
            @PathVariable @Positive(message = "User ID must be positive") Long id,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long currentUserId = authenticatedUserResolver.requireUserId(userPrincipal);
        log.debug("DELETE /api/v1/users/{}, operatorUserId={}", id, currentUserId);
        userService.deleteUser(id, currentUserId);
        return ApiResponse.successNoContent();
    }
}
