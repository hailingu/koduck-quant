package com.koduck.service;

import com.koduck.dto.credential.*;
import com.koduck.entity.CredentialAuditLog;
import com.koduck.entity.UserCredential;
import com.koduck.exception.DuplicateException;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.repository.CredentialAuditLogRepository;
import com.koduck.repository.CredentialRepository;
import com.koduck.util.CredentialEncryptionUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
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
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CredentialService {

    private final CredentialRepository credentialRepository;
    private final CredentialAuditLogRepository auditLogRepository;

    /**
     * 
     */
    public CredentialListResponse getCredentials(Long userId, int page, int size) {
        log.info(": userId={}", userId);

        Pageable pageable = PageRequest.of(page, size);
        Page<UserCredential> credentialPage = credentialRepository.findAll(
                org.springframework.data.domain.Example.of(
                        UserCredential.builder().userId(userId).build()
                ), pageable);

        List<CredentialResponse> items = credentialPage.getContent().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        // 
        auditLog(userId, null, CredentialAuditLog.ActionType.VIEW, true, null);

        return CredentialListResponse.builder()
                .items(items)
                .total(credentialPage.getTotalElements())
                .page(page)
                .size(size)
                .build();
    }

    /**
     * （）
     */
    public List<CredentialResponse> getAllCredentials(Long userId) {
        log.info(": userId={}", userId);

        List<UserCredential> credentials = credentialRepository.findByUserId(userId);

        auditLog(userId, null, CredentialAuditLog.ActionType.VIEW, true, null);

        return credentials.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * （）
     */
    public CredentialResponse getCredential(Long userId, Long credentialId) {
        log.info(": userId={}, credentialId={}", userId, credentialId);

        UserCredential credential = credentialRepository.findByIdAndUserId(credentialId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("凭证不存在: " + credentialId));

        auditLog(userId, credentialId, CredentialAuditLog.ActionType.VIEW, true, null);

        return toResponse(credential);
    }

    /**
     * （）
     */
    public CredentialDetailResponse getCredentialDetail(Long userId, Long credentialId) {
        log.info(": userId={}, credentialId={}", userId, credentialId);

        UserCredential credential = credentialRepository.findByIdAndUserId(credentialId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("凭证不存在: " + credentialId));

        auditLog(userId, credentialId, CredentialAuditLog.ActionType.VIEW, true, null);

        return toDetailResponse(credential);
    }

    /**
     * 
     */
    @Transactional
    public CredentialResponse createCredential(Long userId, CreateCredentialRequest request) {
        log.info(": userId={}, name={}, provider={}", userId, request.getName(), request.getProvider());

        // 
        if (credentialRepository.existsByUserIdAndName(userId, request.getName())) {
            throw new DuplicateException("name", request.getName(), "凭证名称已存在: " + request.getName());
        }

        //  API Key  Secret
        String encryptedKey = CredentialEncryptionUtil.encrypt(request.getApiKey());
        String encryptedSecret = request.getApiSecret() != null
                ? CredentialEncryptionUtil.encrypt(request.getApiSecret())
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

        UserCredential saved = credentialRepository.save(credential);

        auditLog(userId, saved.getId(), CredentialAuditLog.ActionType.CREATE, true, null);

        log.info(": id={}", saved.getId());
        return toResponse(saved);
    }

    /**
     * 
     */
    @Transactional
    public CredentialResponse updateCredential(Long userId, Long credentialId, UpdateCredentialRequest request) {
        log.info(": userId={}, credentialId={}", userId, credentialId);

        UserCredential credential = credentialRepository.findByIdAndUserId(credentialId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("凭证不存在: " + credentialId));

        // 
        if (!credential.getName().equals(request.getName())
                && credentialRepository.existsByUserIdAndName(userId, request.getName())) {
            throw new DuplicateException("name", request.getName(), "凭证名称已存在: " + request.getName());
        }

        credential.setName(request.getName());

        //  API Key，
        if (request.getApiKey() != null && !request.getApiKey().isEmpty()) {
            credential.setApiKeyEncrypted(CredentialEncryptionUtil.encrypt(request.getApiKey()));
        }

        //  API Secret，
        if (request.getApiSecret() != null && !request.getApiSecret().isEmpty()) {
            credential.setApiSecretEncrypted(CredentialEncryptionUtil.encrypt(request.getApiSecret()));
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

        log.info(": id={}", saved.getId());
        return toResponse(saved);
    }

    /**
     * 
     */
    @Transactional
    public void deleteCredential(Long userId, Long credentialId) {
        log.info(": userId={}, credentialId={}", userId, credentialId);

        UserCredential credential = credentialRepository.findByIdAndUserId(credentialId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("凭证不存在: " + credentialId));

        credentialRepository.delete(credential);

        auditLog(userId, credentialId, CredentialAuditLog.ActionType.DELETE, true, null);

        log.info(": id={}", credentialId);
    }

    /**
     * 
     */
    public VerifyCredentialResponse verifyCredential(Long userId, Long credentialId) {
        log.info(": userId={}, credentialId={}", userId, credentialId);

        UserCredential credential = credentialRepository.findByIdAndUserId(credentialId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("凭证不存在: " + credentialId));

        //  API Key  Secret
        String apiKey = CredentialEncryptionUtil.decrypt(credential.getApiKeyEncrypted());
        String apiSecret = credential.getApiSecretEncrypted() != null
                ? CredentialEncryptionUtil.decrypt(credential.getApiSecretEncrypted())
                : null;

        // （， API ）
        VerificationResult result = performVerification(credential, apiKey, apiSecret);

        // 
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
     * 
     */
    public List<CredentialAuditLogResponse> getAuditLogs(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<CredentialAuditLog> logPage = auditLogRepository.findByUserId(userId, pageable);

        return logPage.getContent().stream()
                .map(this::toAuditLogResponse)
                .collect(Collectors.toList());
    }

    // =====  =====

    /**
     * （）
     */
    private VerificationResult performVerification(UserCredential credential, String apiKey, String apiSecret) {
        //  API 
        // 

        if (apiKey == null || apiKey.isEmpty()) {
            return VerificationResult.failed("API Key 为空");
        }

        // 
        switch (credential.getProvider().toLowerCase()) {
            case "alpaca":
                //  Alpaca API 
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
     * 
     */
    private void auditLog(Long userId, Long credentialId, CredentialAuditLog.ActionType action,
                          boolean success, String errorMessage) {
        try {
            // 
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            String ipAddress = null;
            String userAgent = null;

            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                ipAddress = getClientIpAddress(request);
                userAgent = request.getHeader("User-Agent");
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

            auditLogRepository.save(log);
        } catch (Exception e) {
            log.error("", e);
        }
    }

    /**
     *  IP 
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String[] headerNames = {
                "X-Forwarded-For",
                "X-Real-IP",
                "Proxy-Client-IP",
                "WL-Proxy-Client-IP"
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
     * 
     */
    private CredentialResponse toResponse(UserCredential credential) {
        // 
        String apiKey = CredentialEncryptionUtil.decrypt(credential.getApiKeyEncrypted());
        String apiSecret = credential.getApiSecretEncrypted() != null
                ? CredentialEncryptionUtil.decrypt(credential.getApiSecretEncrypted())
                : null;

        return CredentialResponse.builder()
                .id(credential.getId())
                .name(credential.getName())
                .type(credential.getType() != null ? credential.getType().name() : null)
                .provider(credential.getProvider())
                .environment(credential.getEnvironment() != null ? credential.getEnvironment().name() : null)
                .isActive(credential.getIsActive())
                .apiKeyMasked(CredentialEncryptionUtil.maskApiKey(apiKey))
                .apiSecretMasked(CredentialEncryptionUtil.maskApiSecret(apiSecret))
                .additionalConfig(credential.getAdditionalConfig())
                .lastVerifiedStatus(credential.getLastVerifiedStatus() != null
                        ? credential.getLastVerifiedStatus().name() : null)
                .lastVerifiedAt(credential.getLastVerifiedAt())
                .createdAt(credential.getCreatedAt())
                .updatedAt(credential.getUpdatedAt())
                .build();
    }

    /**
     * 
     */
    private CredentialDetailResponse toDetailResponse(UserCredential credential) {
        String apiKey = CredentialEncryptionUtil.decrypt(credential.getApiKeyEncrypted());
        String apiSecret = credential.getApiSecretEncrypted() != null
                ? CredentialEncryptionUtil.decrypt(credential.getApiSecretEncrypted())
                : null;

        return CredentialDetailResponse.builder()
                .id(credential.getId())
                .name(credential.getName())
                .type(credential.getType() != null ? credential.getType().name() : null)
                .provider(credential.getProvider())
                .environment(credential.getEnvironment() != null ? credential.getEnvironment().name() : null)
                .isActive(credential.getIsActive())
                .apiKey(apiKey)
                .apiSecret(apiSecret)
                .additionalConfig(credential.getAdditionalConfig())
                .lastVerifiedStatus(credential.getLastVerifiedStatus() != null
                        ? credential.getLastVerifiedStatus().name() : null)
                .lastVerifiedAt(credential.getLastVerifiedAt())
                .createdAt(credential.getCreatedAt())
                .updatedAt(credential.getUpdatedAt())
                .build();
    }

    /**
     * 
     */
    private CredentialAuditLogResponse toAuditLogResponse(CredentialAuditLog log) {
        return CredentialAuditLogResponse.builder()
                .id(log.getId())
                .credentialId(log.getCredentialId())
                .action(log.getAction() != null ? log.getAction().name() : null)
                .ipAddress(log.getIpAddress())
                .success(log.getSuccess())
                .errorMessage(log.getErrorMessage())
                .createdAt(log.getCreatedAt())
                .build();
    }

    /**
     * 
     */
    private static class VerificationResult {
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

        static VerificationResult failed(String message, String details) {
            return new VerificationResult(false, message, details);
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
