package com.koduck.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * REST API controller for user profile and administrative user management.
 *
 * @author Koduck Team
 */
@RestController
@RequestMapping("/api/v1/users")
@Validated
@Slf4j
@Tag(name = "用户管理", description = "用户资料查询/更新、管理员用户管理接口")
@SecurityRequirement(name = "bearerAuth")
@RequiredArgsConstructor
public class UserController {

    /** The authenticated user resolver. */
    private final AuthenticatedUserResolver authenticatedUserResolver;

    /** The user service. */
    private final UserService userService;

    /**
     * Retrieve current user details.
     *
     * @param userPrincipal the current user authentication principal
     * @return the current user details
     */
    @Operation(
        summary = "获取当前用户信息",
        description = "获取当前登录用户的详细信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = UserDetailResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/me")
    public ApiResponse<UserDetailResponse> getCurrentUser(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = requireUserId(userPrincipal);
        log.debug("GET /api/v1/users/me, userId={}", userId);
        UserDetailResponse response = userService.getCurrentUser(userId);
        return ApiResponse.success(response);
    }

    /**
     * Update current user's profile.
     *
     * @param userPrincipal the current user authentication principal
     * @param request the update profile request
     * @return the updated user details
     */
    @Operation(
        summary = "更新当前用户资料",
        description = "更新当前登录用户的个人资料信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = UserDetailResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/me")
    public ApiResponse<UserDetailResponse> updateProfile(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody UpdateProfileRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("PUT /api/v1/users/me, userId={}", userId);
        UserDetailResponse response = userService.updateProfile(userId, request);
        return ApiResponse.success(response);
    }

    /**
     * Change current user's password.
     *
     * @param userPrincipal the current user authentication principal
     * @param request the change password request
     * @return empty response on success
     */
    @Operation(
        summary = "修改密码",
        description = "修改当前登录用户的密码，需要提供旧密码进行验证"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "密码修改成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误或新密码不符合要求"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或旧密码错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/me/password")
    public ApiResponse<Void> changePassword(
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody ChangePasswordRequest request) {
        Long userId = requireUserId(userPrincipal);
        log.debug("PUT /api/v1/users/me/password, userId={}", userId);
        userService.changePassword(userId, request);
        return ApiResponse.successNoContent();
    }

    /**
     * List users with pagination for administrators.
     *
     * @param request the user page request
     * @return the paginated user list
     */
    @Operation(
        summary = "查询用户列表（管理员）",
        description = "管理员接口：分页查询所有用户信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "查询成功",
            content = @Content(schema = @Schema(implementation = PageResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "权限不足，需要管理员角色"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
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
     *
     * @param id the user ID
     * @return the user details
     */
    @Operation(
        summary = "获取用户详情（管理员）",
        description = "管理员接口：根据用户ID获取用户详细信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = UserDetailResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "权限不足，需要管理员角色"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "用户不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserDetailResponse> getUserById(
            @Parameter(description = "用户ID", example = "1")
            @PathVariable @Positive(message = "User ID must be positive") Long id) {
        log.debug("GET /api/v1/users/{}, admin request", id);
        UserDetailResponse response = userService.getUserById(id);
        return ApiResponse.success(response);
    }

    /**
     * Create user for administrators.
     *
     * @param request the create user request
     * @return the created user details
     */
    @Operation(
        summary = "创建用户（管理员）",
        description = "管理员接口：创建新用户"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "创建成功",
            content = @Content(schema = @Schema(implementation = UserDetailResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "权限不足，需要管理员角色"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "用户名或邮箱已存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
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
     *
     * @param id the user ID
     * @param request the update user request
     * @return the updated user details
     */
    @Operation(
        summary = "更新用户（管理员）",
        description = "管理员接口：更新指定用户信息"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "更新成功",
            content = @Content(schema = @Schema(implementation = UserDetailResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "权限不足，需要管理员角色"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "用户不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserDetailResponse> updateUser(
            @Parameter(description = "用户ID", example = "1")
            @PathVariable @Positive(message = "User ID must be positive") Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        log.debug("PUT /api/v1/users/{}, admin request", id);
        UserDetailResponse response = userService.updateUser(id, request);
        return ApiResponse.success(response);
    }

    /**
     * Delete user for administrators.
     *
     * @param id the user ID to delete
     * @param userPrincipal the current user authentication principal
     * @return empty response on success
     */
    @Operation(
        summary = "删除用户（管理员）",
        description = "管理员接口：删除指定用户\n\n" +
                "注意：不能删除当前登录的管理员账号"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "删除成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "不能删除当前登录账号"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "未登录或Token无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "权限不足，需要管理员角色"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "用户不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteUser(
            @Parameter(description = "用户ID", example = "1")
            @PathVariable @Positive(message = "User ID must be positive") Long id,
            @Parameter(description = "当前用户认证信息", hidden = true)
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long currentUserId = requireUserId(userPrincipal);
        log.debug("DELETE /api/v1/users/{}, operatorUserId={}", id, currentUserId);
        userService.deleteUser(id, currentUserId);
        return ApiResponse.successNoContent();
    }

    private Long requireUserId(UserPrincipal userPrincipal) {
        return authenticatedUserResolver.requireUserId(userPrincipal);
    }
}
