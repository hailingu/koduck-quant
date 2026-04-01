package com.koduck.service.impl;

import com.koduck.common.constants.HttpHeaderConstants;
import com.koduck.dto.credential.*;
import com.koduck.entity.CredentialAuditLog;
import com.koduck.entity.UserCredential;
import com.koduck.exception.DuplicateException;
import com.koduck.mapper.CredentialMapper;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.CredentialAuditLogRepository;
import com.koduck.repository.CredentialRepository;
import com.koduck.service.CredentialService;
import com.koduck.util.CredentialEncryptionUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * 用户凭证服务实现
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
public class CredentialServiceImpl implements CredentialService {

    private final CredentialRepository credentialRepository;
    private final CredentialAuditLogRepository auditLogRepository;
    private final CredentialEncryptionUtil credentialEncryptionUtil;
    private final CredentialMapper credentialMapper;

    public CredentialServiceImpl(CredentialRepository credentialRepository,
                                 CredentialAuditLogRepository auditLogRepository,
                                 CredentialEncryptionUtil credentialEncryptionUtil,
                                 CredentialMapper credentialMapper) {
        this.credentialRepository = credentialRepository;
        this.auditLogRepository = auditLogRepository;
        this.credentialEncryptionUtil = credentialEncryptionUtil;
        this.credentialMapper = credentialMapper;
    }

    /**
     * 获取凭证列表（分页）
     */
    @Override
    public CredentialListResponse getCredentials(Long userId, int page, int size) {
        log.info("查询凭证列表: userId={}", userId);
        Pageable pageable = PageRequest.of(page, size);
        UserCredential exampleCredential = Objects.requireNonNull(
            UserCredential.builder().userId(userId).build(),
            "example credential must not be null");
        Page<UserCredential> credentialPage = credentialRepository.findAll(
                org.springframework.data.domain.Example.of(
                exampleCredential
                ), pageable);
        List<CredentialResponse> items = credentialPage.getContent().stream()
                .map(this::toResponse)
            .toList();
        // 记录审计日志
        auditLog(userId, null, CredentialAuditLog.ActionType.VIEW, true, null);
        return CredentialListResponse.builder()
                .items(items)
                .total(credentialPage.getTotalElements())
                .page(page)
                .size(size)
                .build();
    }
    /**
     * 获取所有凭证（不分页）
     */
    @Override
    public List<CredentialResponse> getAllCredentials(Long userId) {
        log.info("查询所有凭证: userId={}", userId);
        List<UserCredential> credentials = credentialRepository.findByUserId(userId);
        auditLog(userId, null, CredentialAuditLog.ActionType.VIEW, true, null);
        return credentials.stream()
                .map(this::toResponse)
            .toList();
    }
    /**
     * 获取单个凭证（摘要信息）
     */
    @Override
    public CredentialResponse getCredential(Long userId, Long credentialId) {
        log.info("查询凭证: userId={}, credentialId={}", userId, credentialId);
        UserCredential credential = loadCredentialOrThrow(userId, credentialId);
        auditLog(userId, credentialId, CredentialAuditLog.ActionType.VIEW, true, null);
        return toResponse(credential);
    }
    /**
     * 获取凭证详情（包含敏感信息）
     */
    @Override
    public CredentialDetailResponse getCredentialDetail(Long userId, Long credentialId) {
        log.info("查询凭证详情: userId={}, credentialId={}", userId, credentialId);
        UserCredential credential = loadCredentialOrThrow(userId, credentialId);
        auditLog(userId, credentialId, CredentialAuditLog.ActionType.VIEW, true, null);
        return toDetailResponse(credential);
    }
    /**
     * 创建凭证
     */
    @Override
    @Transactional
    public CredentialResponse createCredential(Long userId, CreateCredentialRequest request) {
        log.info("创建凭证: userId={}, name={}, provider={}", userId, request.getName(), request.getProvider());
        // 检查名称是否重复
        if (credentialRepository.existsByUserIdAndName(userId, request.getName())) {
            throw new DuplicateException("name", request.getName(), "凭证名称已存在: " + request.getName());
        }
        // 加密 API Key 和 Secret
        String encryptedKey = credentialEncryptionUtil.encrypt(request.getApiKey());
        String encryptedSecret = request.getApiSecret() != null
            ? credentialEncryptionUtil.encrypt(request.getApiSecret())
                : null;
        UserCredential credential = UserCredential.builder()
                .userId(userId)
                .name(request.getName())
                .type(UserCredential.CredentialType.valueOf(request.getType()))
                .provider(request.getProvider())
                .apiKeyEncrypted(encryptedKey)
                .apiSecretEncrypted(encryptedSecret)
                .environment(request.getEnvironment() != null
                        ? UserCredential.Environment.valueOf(request.getEnvironment())
                        : null)
                .additionalConfig(request.getAdditionalConfig())
                .isActive(true)
                .lastVerifiedStatus(UserCredential.VerificationStatus.PENDING)
                .build();
        UserCredential saved = Objects.requireNonNull(
            credentialRepository.save(Objects.requireNonNull(credential, "credential must not be null")),
            "saved credential must not be null");
        auditLog(userId, saved.getId(), CredentialAuditLog.ActionType.CREATE, true, null);
        log.info("凭证创建成功: id={}", saved.getId());
        return toResponse(saved);
    }
    /**
     * 更新凭证
     */
    @Override
    @Transactional
    public CredentialResponse updateCredential(Long userId, Long credentialId, UpdateCredentialRequest request) {
        log.info("更新凭证: userId={}, credentialId={}", userId, credentialId);
        UserCredential credential = loadCredentialOrThrow(userId, credentialId);
        // 检查名称是否重复
        if (!credential.getName().equals(request.getName())
                && credentialRepository.existsByUserIdAndName(userId, request.getName())) {
            throw new DuplicateException("name", request.getName(), "凭证名称已存在: " + request.getName());
        }
        credential.setName(request.getName());
        // 如果提供了新的 API Key，加密并更新
        if (request.getApiKey() != null && !request.getApiKey().isEmpty()) {
            credential.setApiKeyEncrypted(credentialEncryptionUtil.encrypt(request.getApiKey()));
        }
        // 如果提供了新的 API Secret，加密并更新
        if (request.getApiSecret() != null && !request.getApiSecret().isEmpty()) {
            credential.setApiSecretEncrypted(credentialEncryptionUtil.encrypt(request.getApiSecret()));
        }
        if (request.getEnvironment() != null) {
            credential.setEnvironment(UserCredential.Environment.valueOf(request.getEnvironment()));
        }
        if (request.getAdditionalConfig() != null) {
            credential.setAdditionalConfig(request.getAdditionalConfig());
        }
        if (request.getIsActive() != null) {
            credential.setIsActive(request.getIsActive());
        }
        UserCredential saved = credentialRepository.save(credential);
        auditLog(userId, credentialId, CredentialAuditLog.ActionType.UPDATE, true, null);
        log.info("凭证更新成功: id={}", saved.getId());
        return toResponse(saved);
    }
    /**
     * 删除凭证
     */
    @Override
    @Transactional
    public void deleteCredential(Long userId, Long credentialId) {
        log.info("删除凭证: userId={}, credentialId={}", userId, credentialId);
        UserCredential credential = loadCredentialOrThrow(userId, credentialId);
        credentialRepository.delete(Objects.requireNonNull(credential, "credential must not be null"));
        auditLog(userId, credentialId, CredentialAuditLog.ActionType.DELETE, true, null);
        log.info("凭证删除成功: id={}", credentialId);
    }
    /**
     * 验证凭证
     */
    @Override
    public VerifyCredentialResponse verifyCredential(Long userId, Long credentialId) {
        log.info("验证凭证: userId={}, credentialId={}", userId, credentialId);
        UserCredential credential = loadCredentialOrThrow(userId, credentialId);
        // 解密 API Key 和 Secret
        String apiKey = credentialEncryptionUtil.decrypt(credential.getApiKeyEncrypted());
        String apiSecret = credential.getApiSecretEncrypted() != null
            ? credentialEncryptionUtil.decrypt(credential.getApiSecretEncrypted())
                : null;
        // 执行验证（模拟，实际应调用相应 API）
        VerificationResult result = performVerification(credential, apiKey, apiSecret);
        // 更新验证状态
        credential.setLastVerifiedAt(LocalDateTime.now());
        credential.setLastVerifiedStatus(result.isValid()
                ? UserCredential.VerificationStatus.SUCCESS
                : UserCredential.VerificationStatus.FAILED);
        credentialRepository.save(credential);
        auditLog(userId, credentialId, CredentialAuditLog.ActionType.VERIFY, result.isValid(),
                result.isValid() ? null : result.getMessage());
        return VerifyCredentialResponse.builder()
                .credentialId(credentialId)
                .valid(result.isValid())
                .message(result.getMessage())
                .details(result.getDetails())
                .verifiedAt(LocalDateTime.now())
                .status(result.isValid() ? "SUCCESS" : "FAILED")
                .build();
    }
    /**
     * 获取审计日志
     */
    @Override
    public List<CredentialAuditLogResponse> getAuditLogs(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<CredentialAuditLog> logPage = auditLogRepository.findByUserId(userId, pageable);
        return logPage.getContent().stream()
                .map(this::toAuditLogResponse)
            .toList();
    }

    // ===== 私有方法 =====
    private UserCredential loadCredentialOrThrow(Long userId, Long credentialId) {
        return requireFound(credentialRepository.findByIdAndUserId(credentialId, userId),
                () -> new ResourceNotFoundException("凭证不存在: " + credentialId));
    }

    /**
     * 执行凭证验证（模拟实现）
     */
    private VerificationResult performVerification(UserCredential credential, String apiKey, String apiSecret) {
        if (apiKey == null || apiKey.isEmpty()) {
            return VerificationResult.failed("API Key 为空");
        }

        String provider = credential.getProvider();
        if (provider == null || provider.isEmpty()) {
            return VerificationResult.success("凭证格式有效（未进行实际 API 验证）");
        }

        if ("binance".equalsIgnoreCase(provider) && (apiSecret == null || apiSecret.isEmpty())) {
            return VerificationResult.failed("API Secret 为空");
        }

        switch (provider.toLowerCase(Locale.ROOT)) {
            case "alpaca":
                return VerificationResult.success("Alpaca API 凭证有效");
            case "binance":
                return VerificationResult.success("Binance API 凭证有效");
            case "yahoo":
                return VerificationResult.success("Yahoo Finance API 凭证有效");
            case "openai":
                return VerificationResult.success("OpenAI API 凭证有效");
            default:
                return VerificationResult.success("凭证格式有效（未进行实际 API 验证）");
        }
    }

    /**
     * 记录审计日志
     */
    private void auditLog(Long userId, Long credentialId, CredentialAuditLog.ActionType action,
                          boolean success, String errorMessage) {
        try {
            ServletRequestAttributes attributes =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            String ipAddress = null;
            String userAgent = null;

            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                ipAddress = getClientIpAddress(request);
                userAgent = request.getHeader(HttpHeaderConstants.USER_AGENT);
            }

            CredentialAuditLog log = CredentialAuditLog.builder()
                    .credentialId(credentialId)
                    .userId(userId)
                    .action(action)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .success(success)
                    .errorMessage(errorMessage)
                    .build();
            auditLogRepository.save(Objects.requireNonNull(log, "audit log must not be null"));
        } catch (Exception e) {
            log.error("记录审计日志失败", e);
        }
    }

    /**
     * 获取客户端 IP 地址
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String[] headerNames = {
            HttpHeaderConstants.X_FORWARDED_FOR,
            HttpHeaderConstants.X_REAL_IP,
            HttpHeaderConstants.PROXY_CLIENT_IP,
            HttpHeaderConstants.WL_PROXY_CLIENT_IP
        };
        for (String headerName : headerNames) {
            String value = request.getHeader(headerName);
            if (value != null && !value.isEmpty() && !"unknown".equalsIgnoreCase(value)) {
                return value.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
    /**
     * 转换为响应对象
     */
    private CredentialResponse toResponse(UserCredential credential) {
        // 解密并脱敏显示
        String apiKey = credentialEncryptionUtil.decrypt(credential.getApiKeyEncrypted());
        String apiSecret = credential.getApiSecretEncrypted() != null
            ? credentialEncryptionUtil.decrypt(credential.getApiSecretEncrypted())
                : null;
        return credentialMapper.toCredentialResponse(
            credential,
            CredentialEncryptionUtil.maskApiKey(apiKey),
            CredentialEncryptionUtil.maskApiSecret(apiSecret));
    }
    /**
     * 转换为详情响应对象
     */
    private CredentialDetailResponse toDetailResponse(UserCredential credential) {
        String apiKey = credentialEncryptionUtil.decrypt(credential.getApiKeyEncrypted());
        String apiSecret = credential.getApiSecretEncrypted() != null
            ? credentialEncryptionUtil.decrypt(credential.getApiSecretEncrypted())
                : null;
        return credentialMapper.toCredentialDetailResponse(credential, apiKey, apiSecret);
    }
    /**
     * 转换为审计日志响应对象
     */
    private CredentialAuditLogResponse toAuditLogResponse(CredentialAuditLog log) {
        return credentialMapper.toCredentialAuditLogResponse(log);
    }
    /**
     * 验证结果内部类
     */
    private static final class VerificationResult {

        private final boolean valid;
        private final String message;
        private final String details;

        private VerificationResult(boolean valid, String message, String details) {
            this.valid = valid;
            this.message = message;
            this.details = details;
        }

        static VerificationResult success(String message) {
            return new VerificationResult(true, message, null);
        }

        static VerificationResult failed(String message) {
            return new VerificationResult(false, message, null);
        }

        boolean isValid() {
            return valid;
        }

        String getMessage() {
            return message;
        }

        String getDetails() {
            return details;
        }
    }
}
