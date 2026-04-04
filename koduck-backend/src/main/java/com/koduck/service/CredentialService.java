package com.koduck.service;

import java.util.List;

import com.koduck.dto.credential.CreateCredentialRequest;
import com.koduck.dto.credential.CredentialAuditLogResponse;
import com.koduck.dto.credential.CredentialDetailResponse;
import com.koduck.dto.credential.CredentialListResponse;
import com.koduck.dto.credential.CredentialResponse;
import com.koduck.dto.credential.UpdateCredentialRequest;
import com.koduck.dto.credential.VerifyCredentialResponse;

/**
 * 用户凭证服务接口。
 *
 * @author Koduck Team
 */
public interface CredentialService {

    /**
     * 获取凭证列表（分页）。
     *
     * @param userId 用户ID
     * @param page   页码
     * @param size   每页大小
     * @return 凭证列表响应
     */
    CredentialListResponse getCredentials(Long userId, int page, int size);

    /**
     * 获取所有凭证（不分页）。
     *
     * @param userId 用户ID
     * @return 凭证响应列表
     */
    List<CredentialResponse> getAllCredentials(Long userId);

    /**
     * 获取单个凭证（摘要信息）。
     *
     * @param userId       用户ID
     * @param credentialId 凭证ID
     * @return 凭证响应
     */
    CredentialResponse getCredential(Long userId, Long credentialId);

    /**
     * 获取凭证详情（包含敏感信息）。
     *
     * @param userId       用户ID
     * @param credentialId 凭证ID
     * @return 凭证详情响应
     */
    CredentialDetailResponse getCredentialDetail(Long userId, Long credentialId);

    /**
     * 创建新凭证。
     *
     * @param userId  用户ID
     * @param request 创建请求
     * @return 创建的凭证响应
     */
    CredentialResponse createCredential(Long userId, CreateCredentialRequest request);

    /**
     * 更新现有凭证。
     *
     * @param userId       用户ID
     * @param credentialId 凭证ID
     * @param request      更新请求
     * @return 更新后的凭证响应
     */
    CredentialResponse updateCredential(Long userId, Long credentialId, UpdateCredentialRequest request);

    /**
     * 删除凭证。
     *
     * @param userId       用户ID
     * @param credentialId 凭证ID
     */
    void deleteCredential(Long userId, Long credentialId);

    /**
     * 验证凭证。
     *
     * @param userId       用户ID
     * @param credentialId 凭证ID
     * @return 验证响应
     */
    VerifyCredentialResponse verifyCredential(Long userId, Long credentialId);

    /**
     * 获取审计日志。
     *
     * @param userId 用户ID
     * @param page   页码
     * @param size   每页大小
     * @return 审计日志响应列表
     */
    List<CredentialAuditLogResponse> getAuditLogs(Long userId, int page, int size);
}
