package com.koduck.service;

import com.koduck.dto.credential.*;
import java.util.List;

/**
 * 用户凭证服务接口
 */
public interface CredentialService {

    /**
     * 获取凭证列表（分页）
     */
    CredentialListResponse getCredentials(Long userId, int page, int size);

    /**
     * 获取所有凭证（不分页）
     */
    List<CredentialResponse> getAllCredentials(Long userId);

    /**
     * 获取单个凭证（摘要信息）
     */
    CredentialResponse getCredential(Long userId, Long credentialId);

    /**
     * 获取凭证详情（包含敏感信息）
     */
    CredentialDetailResponse getCredentialDetail(Long userId, Long credentialId);

    /**
     * 创建凭证
     */
    CredentialResponse createCredential(Long userId, CreateCredentialRequest request);

    /**
     * 更新凭证
     */
    CredentialResponse updateCredential(Long userId, Long credentialId, UpdateCredentialRequest request);

    /**
     * 删除凭证
     */
    void deleteCredential(Long userId, Long credentialId);

    /**
     * 验证凭证
     */
    VerifyCredentialResponse verifyCredential(Long userId, Long credentialId);

    /**
     * 获取审计日志
     */
    List<CredentialAuditLogResponse> getAuditLogs(Long userId, int page, int size);
}
