package com.koduck.service;
import com.koduck.dto.common.PageResponse;
import com.koduck.dto.user.*;

/**
 * 用户服务接口。
 */
public interface UserService {

    /**
     * 获取当前用户信息。
     *
     * @param userId 用户ID
     * @return 用户详情响应
     */
    UserDetailResponse getCurrentUser(Long userId);

    /**
     * 更新用户个人资料。
     *
     * @param userId  用户ID
     * @param request 更新资料请求
     * @return 更新后的用户详情
     */
    UserDetailResponse updateProfile(Long userId, UpdateProfileRequest request);

    /**
     * 修改密码。
     *
     * @param userId  用户ID
     * @param request 修改密码请求
     */
    void changePassword(Long userId, ChangePasswordRequest request);

    /**
     * 分页查询用户列表。
     *
     * @param request 分页请求参数
     * @return 分页用户列表
     */
    PageResponse<UserDetailResponse> listUsers(UserPageRequest request);

    /**
     * 根据ID获取用户详情。
     *
     * @param userId 用户ID
     * @return 用户详情响应
     */
    UserDetailResponse getUserById(Long userId);

    /**
     * 创建新用户。
     *
     * @param request 创建用户请求
     * @return 创建后的用户详情
     */
    UserDetailResponse createUser(CreateUserRequest request);

    /**
     * 更新用户信息。
     *
     * @param userId  用户ID
     * @param request 更新用户请求
     * @return 更新后的用户详情
     */
    UserDetailResponse updateUser(Long userId, UpdateUserRequest request);

    /**
     * 删除用户。
     *
     * @param userId        要删除的用户ID
     * @param currentUserId 当前操作用户ID（用于防止自删）
     */
    void deleteUser(Long userId, Long currentUserId);
}
